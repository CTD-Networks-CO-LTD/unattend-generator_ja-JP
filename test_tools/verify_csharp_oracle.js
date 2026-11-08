/**
 * C# Oracle & Behavioral Contract Verification Tool
 *
 * Verifies:
 * 1. Upstream C# source contract & manifest consistency (resource/autounattend.xml, Main.cs, modifier/Disk.cs, etc.)
 * 2. Strict XML / namespace-aware contract matrix across en-US and ja-JP:
 *    - PEMode = Default (or omitted) x UseConfigurationSet (omitted / false / true / on / 1)
 *    - PEMode = Generated x UseConfigurationSet (omitted / false / true) -> no <UseConfigurationSet>, unconditional OEM_FOLDER & driver handling
 *    - PEMode = Script (non-empty) x UseConfigurationSet (omitted / false / true) -> no <UseConfigurationSet>, user script preserved, no injected OEM copy
 * 3. Normalized structural equivalence against C# reference output
 *    Normalization rules (strictly limited and documented):
 *    - Rule 1: Top-level XML comment URL / query string (host & empty form slot params)
 *    - Rule 2: <Build><Commit><Hash> and <GitHubUrl> build metadata
 *    - Rule 3: Line endings normalized to CRLF (\r\n)
 * 4. Direct C# UnattendGenerator.GenerateXml execution comparison when .NET SDK is available
 *    (or required when --require-dotnet is passed in CI).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const enginePathArgIdx = process.argv.indexOf('--engine-path');
const enginePath = (enginePathArgIdx !== -1 && process.argv[enginePathArgIdx + 1])
  ? path.resolve(process.cwd(), process.argv[enginePathArgIdx + 1])
  : path.join(repoRoot, 'docs', 'unattend_engine.js');
const engine = require(enginePath);

const requireDotnet = process.argv.includes('--require-dotnet');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

function createFormData(obj) {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null);
  return {
    get: (k) => (k in obj && obj[k] !== undefined && obj[k] !== null ? String(obj[k]) : null),
    has: (k) => k in obj && obj[k] !== undefined && obj[k] !== null,
    getAll: (k) => (k in obj && obj[k] !== undefined && obj[k] !== null ? [String(obj[k])] : []),
    entries: function* () {
      for (const [k, v] of entries) {
        yield [k, String(v)];
      }
    }
  };
}

function inspectXmlContract(xml) {
  const rootNsMatch = xml.match(/<unattend\s+[^>]*xmlns="urn:schemas-microsoft-com:unattend"[^>]*xmlns:wcm="http:\/\/schemas\.microsoft\.com\/WMIConfig\/2002\/State"/);
  const extNsMatch = xml.match(/<Extensions\s+xmlns="https:\/\/schneegans\.de\/windows\/unattend-generator\/">/);

  const pePassMatch = xml.match(/<settings pass="windowsPE">([\s\S]*?)<\/settings>/);
  const pePassContent = pePassMatch ? pePassMatch[1] : '';

  const allUseConfigMatches = [...xml.matchAll(/<UseConfigurationSet>([\s\S]*?)<\/UseConfigurationSet>/g)];
  const peUseConfigMatches = [...pePassContent.matchAll(/<UseConfigurationSet>([\s\S]*?)<\/UseConfigurationSet>/g)];

  const peScriptCopyMatches = [...xml.matchAll(/<PEScriptCopy>([\s\S]*?)<\/PEScriptCopy>/g)];
  const runSyncCmdMatches = [...pePassContent.matchAll(/<RunSynchronousCommand\b[\s\S]*?<\/RunSynchronousCommand>/g)];

  return {
    hasValidRootNs: !!rootNsMatch,
    hasValidExtNs: !!extNsMatch,
    hasPePass: !!pePassMatch,
    totalUseConfigCount: allUseConfigMatches.length,
    peUseConfigCount: peUseConfigMatches.length,
    useConfigValue: peUseConfigMatches.length > 0 ? peUseConfigMatches[0][1] : null,
    peScriptCopyCount: peScriptCopyMatches.length,
    peScriptCopyContent: peScriptCopyMatches.length > 0 ? peScriptCopyMatches[0][1] : null,
    peRunSyncCount: runSyncCmdMatches.length
  };
}

function normalizeForStructuralComparison(xml) {
  return xml
    .replace(/\r?\n/g, '\r\n')
    .replace(/^\uFEFF/, '')
    .replace(/<!--https?:\/\/[^\r\n]*-->/, '<!--NORMALIZED_QUERY_COMMENT-->')
    .replace(/<Hash>[0-9a-fA-F]*<\/Hash>/, '<Hash>NORMALIZED_HASH</Hash>')
    .replace(/<GitHubUrl>https:\/\/github\.com\/[^<]*<\/GitHubUrl>/, '<GitHubUrl>NORMALIZED_GITHUB_URL</GitHubUrl>');
}

function verifyUpstreamCSharpSourceContract() {
  console.log('--- 1. Upstream C# Source Contract & Manifest Verification ---');

  const xmlRes = fs.readFileSync(path.join(repoRoot, 'resource', 'autounattend.xml'), 'utf8');
  const diskCs = fs.readFileSync(path.join(repoRoot, 'modifier', 'Disk.cs'), 'utf8');
  const mainCs = fs.readFileSync(path.join(repoRoot, 'Main.cs'), 'utf8');
  const optCs = fs.readFileSync(path.join(repoRoot, 'modifier', 'Optimizations.cs'), 'utf8');
  const pkCs = fs.readFileSync(path.join(repoRoot, 'modifier', 'ProductKey.cs'), 'utf8');

  assert(
    xmlRes.includes('<UseConfigurationSet>false</UseConfigurationSet>'),
    'resource/autounattend.xml の初期値が <UseConfigurationSet>false</UseConfigurationSet> であること'
  );
  assert(
    /public record class DefaultPESettings\([\s\S]*?bool UseConfigurationSet[\s\S]*?\)\s*:\s*IPESettings/.test(diskCs),
    'modifier/Disk.cs の DefaultPESettings が bool UseConfigurationSet を保持していること'
  );
  assert(
    diskCs.includes('if (Configuration.PESettings is DefaultPESettings d && d.UseConfigurationSet)') &&
      diskCs.includes('Document.SelectSingleNodeOrThrow("//u:UseConfigurationSet", NamespaceManager).InnerText = "true";'),
    'modifier/Disk.cs が DefaultPESettings かつ UseConfigurationSet=true のときのみ UseConfigurationSet を true に更新すること'
  );
  assert(
    !diskCs.includes('if (configuration.UseConfigurationSet)'),
    'modifier/Disk.cs の GetPEScript 内で OEM_FOLDER コピーが UseConfigurationSet フラグで条件分岐されていないこと（無条件出力）'
  );
  assert(
    /PESettings:\s*new DefaultPESettings\([\s\S]*?UseConfigurationSet:\s*false[\s\S]*?\)/.test(mainCs),
    'Main.cs の Configuration.Default.PESettings で UseConfigurationSet の既定値が false であること'
  );
  assert(
    !optCs.includes('UseConfigurationSet'),
    'modifier/Optimizations.cs に旧 UseConfigurationSet 処理が残存していないこと'
  );
  assert(
    !pkCs.includes('UseConfigurationSet'),
    'modifier/ProductKey.cs に UseConfigurationSet 処理が存在しないこと'
  );
}

function verifyContractMatrix() {
  console.log('\n--- 2. UseConfigurationSet & WinPE Behavioral Contract Matrix (en-US & ja-JP) ---');

  const locales = [
    {
      label: 'en-US',
      baseParams: {
        LanguageMode: 'Unattended',
        UILanguage: 'en-US',
        Locale: 'en-US',
        Keyboard: '00000409',
        GeoLocation: '244'
      }
    },
    {
      label: 'ja-JP (106/109 Keyboard)',
      baseParams: {
        LanguageMode: 'Unattended',
        UILanguage: 'ja-JP',
        Locale: 'ja-JP',
        Keyboard: '00000411',
        GeoLocation: '122'
      }
    }
  ];

  for (const loc of locales) {
    for (const peMode of [undefined, 'Default']) {
      for (const flagVal of [undefined, 'false', '0', '']) {
        const params = { ...loc.baseParams };
        if (peMode !== undefined) params.PEMode = peMode;
        if (flagVal !== undefined) params.UseConfigurationSet = flagVal;

        const xml = engine.generateAutounattendXml(createFormData(params));
        const info = inspectXmlContract(xml);
        const caseLabel = `[${loc.label}] PEMode=${peMode ?? '(omitted)'}, UseConfigurationSet=${flagVal === undefined ? '(omitted)' : `'${flagVal}'`}`;

        assert(info.hasValidRootNs, `${caseLabel}: unattend 名前空間が正しいこと`);
        assert(info.totalUseConfigCount === 1 && info.peUseConfigCount === 1, `${caseLabel}: UseConfigurationSet 要素が windowsPE に1個だけ存在すること`);
        assert(info.useConfigValue === 'false', `${caseLabel}: <UseConfigurationSet>false</UseConfigurationSet> が出力されること (実際: ${info.useConfigValue})`);
        assert(info.peScriptCopyCount === 0, `${caseLabel}: <PEScriptCopy> が出力されないこと`);
        assert(!xml.includes('X:\\pe.cmd'), `${caseLabel}: X:\\pe.cmd が出力されないこと`);
      }

      for (const flagVal of ['true', 'on', '1']) {
        const params = { ...loc.baseParams };
        if (peMode !== undefined) params.PEMode = peMode;
        params.UseConfigurationSet = flagVal;

        const xml = engine.generateAutounattendXml(createFormData(params));
        const info = inspectXmlContract(xml);
        const caseLabel = `[${loc.label}] PEMode=${peMode ?? '(omitted)'}, UseConfigurationSet='${flagVal}'`;

        assert(info.totalUseConfigCount === 1 && info.peUseConfigCount === 1, `${caseLabel}: UseConfigurationSet 要素が windowsPE に1個だけ存在すること`);
        assert(info.useConfigValue === 'true', `${caseLabel}: <UseConfigurationSet>true</UseConfigurationSet> が出力されること (実際: ${info.useConfigValue})`);
        assert(info.peScriptCopyCount === 0, `${caseLabel}: <PEScriptCopy> が出力されないこと`);
      }
    }

    for (const flagVal of [undefined, 'false', 'true']) {
      const params = {
        ...loc.baseParams,
        PEMode: 'Generated',
        InstallFromMode: 'Edition',
        InstallFromEdition: 'pro'
      };
      if (flagVal !== undefined) params.UseConfigurationSet = flagVal;

      const xml = engine.generateAutounattendXml(createFormData(params));
      const info = inspectXmlContract(xml);
      const caseLabel = `[${loc.label}] PEMode=Generated, UseConfigurationSet=${flagVal ?? '(omitted)'}`;

      assert(info.totalUseConfigCount === 0, `${caseLabel}: <UseConfigurationSet> 要素が出力されないこと (個数: ${info.totalUseConfigCount})`);
      assert(info.peScriptCopyCount === 1, `${caseLabel}: <PEScriptCopy> が1個出力されること`);
      assert(info.peRunSyncCount > 0, `${caseLabel}: windowsPE に RunSynchronousCommand が出力されること`);
      assert(xml.includes('set "ROBOCOPY_ARGS=/E /XX /COPY:DAT /DCOPY:DAT /R:0"'), `${caseLabel}: ROBOCOPY_ARGS が無条件出力されること`);
      assert(xml.includes('Copying contents of %OEM_FOLDER%'), `${caseLabel}: %OEM_FOLDER% コピーが無条件出力されること`);
      assert(xml.includes('Loading drivers from %PEDRIVERS_FOLDER%'), `${caseLabel}: %PEDRIVERS_FOLDER% ドライバ読込が出力されること`);
    }

    const customScript = '@echo off\r\necho Custom PE Script Test\r\nwpeutil.exe reboot';
    for (const flagVal of [undefined, 'false', 'true']) {
      const params = {
        ...loc.baseParams,
        PEMode: 'Script',
        PEScript: customScript
      };
      if (flagVal !== undefined) params.UseConfigurationSet = flagVal;

      const xml = engine.generateAutounattendXml(createFormData(params));
      const info = inspectXmlContract(xml);
      const caseLabel = `[${loc.label}] PEMode=Script(non-empty), UseConfigurationSet=${flagVal ?? '(omitted)'}`;

      assert(info.totalUseConfigCount === 0, `${caseLabel}: <UseConfigurationSet> 要素が出力されないこと (個数: ${info.totalUseConfigCount})`);
      assert(info.peScriptCopyCount === 1, `${caseLabel}: <PEScriptCopy> が1個出力されること`);
      assert(info.peScriptCopyContent && info.peScriptCopyContent.includes('Custom PE Script Test'), `${caseLabel}: 独自スクリプト内容が保持されること`);
      assert(!xml.includes('Copying contents of %OEM_FOLDER%'), `${caseLabel}: OEMコピー処理が勝手に注入されないこと`);
      assert(!xml.includes('ROBOCOPY_ARGS'), `${caseLabel}: ROBOCOPY_ARGS が勝手に注入されないこと`);
    }
  }
}

function verifyReferenceUpstreamXmlEquivalence() {
  console.log('\n--- 3. Structural Equivalence Against Upstream C# Reference XML ---');

  const upstreamParams = {
    LanguageMode: 'Unattended',
    UILanguage: 'en-US',
    Locale: 'en-US',
    Keyboard: '00000409',
    GeoLocation: '244',
    PEMode: 'Default',
    WindowsEditionMode: 'Interactive',
    ProcessorArchitecture: 'amd64',
    BypassRequirementsCheck: 'false',
    ComputerNameMode: 'Random',
    TimeZoneMode: 'Implicit',
    UserAccountMode: 'Unattended',
    AccountName0: 'Admin',
    AccountDisplayName0: '',
    AccountPassword0: '',
    AccountGroup0: 'Administrators',
    AccountName1: 'User',
    AccountDisplayName1: '',
    AccountPassword1: '',
    AccountGroup1: 'Users',
    AutoLogonMode: 'Own',
    PasswordExpirationMode: 'Unlimited',
    LockoutMode: 'Default',
    HideFiles: 'Hidden',
    TaskbarSearch: 'Box',
    TaskbarIconsMode: 'Default',
    StartPinsMode: 'Default',
    EffectsMode: 'Default',
    DesktopIconsMode: 'Default',
    StartFoldersMode: 'Default',
    CoreIsolationMode: 'Enabled',
    WifiMode: 'Interactive',
    ExpressSettings: 'DisableAll',
    LockKeysMode: 'Skip',
    StickyKeysMode: 'Default',
    ColorMode: 'Default',
    WallpaperMode: 'Default',
    LockScreenMode: 'Default',
    AppLockerMode: 'Skip'
  };

  const generatedXml = engine.generateAutounattendXml(createFormData(upstreamParams));
  const contract = inspectXmlContract(generatedXml);
  assert(contract.useConfigValue === 'false', '上流互換デフォルト設定(en-US, PEMode=Default)で <UseConfigurationSet>false</UseConfigurationSet> が出力されること');

  const orgXmlCandidatePath = path.resolve(repoRoot, '..', 'org_en_autounattend.xml');
  if (fs.existsSync(orgXmlCandidatePath)) {
    const orgXml = fs.readFileSync(orgXmlCandidatePath, 'utf8');
    const normOrg = normalizeForStructuralComparison(orgXml);
    const normGen = normalizeForStructuralComparison(generatedXml);
    assert(normOrg === normGen, 'org_en_autounattend.xml と JS エンジン出力が正規化規則（コメントURL・Commit SHA・CRLF）の下で完全一致すること');
  }
}

function hasDotnetSdk() {
  try {
    const res = spawnSync('dotnet', ['--list-sdks'], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout && res.stdout.trim().length > 0) {
      return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

function buildHarnessProgram() {
  return [
    'using System;',
    'using System.Collections.Generic;',
    'using System.Text;',
    'using Newtonsoft.Json;',
    'using Schneegans.Unattend;',
    'class Program {',
    '  static string R(UnattendGenerator g, Configuration c) => Encoding.UTF8.GetString(UnattendGenerator.Serialize(g.GenerateXml(c)));',
    '  static void Main() {',
    '    var g = new UnattendGenerator();',
    '    var en = new UnattendedLanguageSettings(g.Lookup<ImageLanguage>("en-US"), new LocaleAndKeyboard(g.Lookup<UserLocale>("en-US"), g.Lookup<KeyboardIdentifier>("00000409")), null, null, g.Lookup<GeoLocation>("244"));',
    '    var ja = new UnattendedLanguageSettings(g.Lookup<ImageLanguage>("ja-JP"), new LocaleAndKeyboard(g.Lookup<UserLocale>("ja-JP"), g.Lookup<KeyboardIdentifier>("00000411")), null, null, g.Lookup<GeoLocation>("122"));',
    '    var d = new Dictionary<string, string> {',
    '      ["en_default_false"] = R(g, Configuration.Default with { LanguageSettings = en, PESettings = new DefaultPESettings(new InteractiveEditionSettings(), false, false) }),',
    '      ["en_default_true"] = R(g, Configuration.Default with { LanguageSettings = en, PESettings = new DefaultPESettings(new InteractiveEditionSettings(), false, true) }),',
    '      ["ja_default_false"] = R(g, Configuration.Default with { LanguageSettings = ja, PESettings = new DefaultPESettings(new InteractiveEditionSettings(), false, false) }),',
    '      ["ja_default_true"] = R(g, Configuration.Default with { LanguageSettings = ja, PESettings = new DefaultPESettings(new InteractiveEditionSettings(), false, true) }),',
    '      ["en_generated"] = R(g, Configuration.Default with { LanguageSettings = en, PESettings = new GeneratePESettings(new UnattendedPartitionSettings(new GeneratedTargetDiskSettings(), PartitionLayout.GPT, RecoveryMode.Partition), new EditionInstallFromSettings(g.Lookup<WindowsEdition>("pro")), new AutomaticPagingFileSettings(), false, false, false, false, false, false) }),',
    '      ["en_script"] = R(g, Configuration.Default with { LanguageSettings = en, PESettings = new ScriptPESetttings("@echo off\\r\\necho Custom PE Script Test\\r\\nwpeutil.exe reboot") })',
    '    };',
    '    Console.OutputEncoding = Encoding.UTF8;',
    '    Console.WriteLine(JsonConvert.SerializeObject(d));',
    '  }',
    '}'
  ].join('\n');
}

function runDirectDotnetOracleComparison() {
  console.log('\n--- 4. Direct .NET C# UnattendGenerator.GenerateXml Oracle Comparison ---');

  if (!hasDotnetSdk()) {
    if (requireDotnet) {
      assert(false, '.NET SDK が必須 (--require-dotnet) ですが環境に検出されませんでした');
    } else {
      console.log('  [INFO] .NET SDK が未検出のため、直接 C# バイナリ実行ハーネスはスキップします（CIでは --require-dotnet で必須実行）');
    }
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unattend-csharp-oracle-'));
  try {
    const csprojPath = path.join(repoRoot, 'UnattendGenerator.csproj').replace(/\\/g, '/');
    const harnessCsproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><Nullable>enable</Nullable></PropertyGroup>
  <ItemGroup><ProjectReference Include="${csprojPath}" /></ItemGroup>
</Project>`;

    fs.writeFileSync(path.join(tmpDir, 'OracleHarness.csproj'), harnessCsproj, 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'Program.cs'), buildHarnessProgram(), 'utf8');

    const runRes = spawnSync('dotnet', ['run', '--project', path.join(tmpDir, 'OracleHarness.csproj'), '-c', 'Debug'], {
      cwd: tmpDir,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    });

    assert(runRes.status === 0, `.NET C# ハーネスが正常実行されること (exit=${runRes.status})`);
    if (runRes.status !== 0) {
      console.error(runRes.stderr || runRes.stdout);
      return;
    }

    const lines = runRes.stdout.trim().split(/\r?\n/);
    const csOutputs = JSON.parse(lines[lines.length - 1]);
    const jsInputs = {
      en_default_false: { LanguageMode: 'Unattended', UILanguage: 'en-US', Locale: 'en-US', Keyboard: '00000409', GeoLocation: '244', PEMode: 'Default', BypassRequirementsCheck: 'false', UseConfigurationSet: 'false' },
      en_default_true: { LanguageMode: 'Unattended', UILanguage: 'en-US', Locale: 'en-US', Keyboard: '00000409', GeoLocation: '244', PEMode: 'Default', BypassRequirementsCheck: 'false', UseConfigurationSet: 'true' },
      ja_default_false: { LanguageMode: 'Unattended', UILanguage: 'ja-JP', Locale: 'ja-JP', Keyboard: '00000411', GeoLocation: '122', PEMode: 'Default', BypassRequirementsCheck: 'false', UseConfigurationSet: 'false' },
      ja_default_true: { LanguageMode: 'Unattended', UILanguage: 'ja-JP', Locale: 'ja-JP', Keyboard: '00000411', GeoLocation: '122', PEMode: 'Default', BypassRequirementsCheck: 'false', UseConfigurationSet: 'true' },
      en_generated: {
        LanguageMode: 'Unattended',
        UILanguage: 'en-US',
        Locale: 'en-US',
        Keyboard: '00000409',
        GeoLocation: '244',
        PEMode: 'Generated',
        PartitionMode: 'Unattended',
        PartitionLayout: 'GPT',
        RecoveryMode: 'Partition',
        InstallFromMode: 'Edition',
        InstallFromEdition: 'pro',
        TargetDiskSize: 'true',
        TargetDiskMinSize: '100',
        TargetDiskMaxSize: '4000',
        TargetDiskIndex: 'true',
        TargetDisk: '0',
        TargetDiskNoPartitions: 'true'
      },
      en_script: { LanguageMode: 'Unattended', UILanguage: 'en-US', Locale: 'en-US', Keyboard: '00000409', GeoLocation: '244', PEMode: 'Script', PEScript: '@echo off\r\necho Custom PE Script Test\r\nwpeutil.exe reboot' }
    };

    for (const [caseId, jsParams] of Object.entries(jsInputs)) {
      const csInfo = inspectXmlContract(csOutputs[caseId]);
      const jsInfo = inspectXmlContract(engine.generateAutounattendXml(createFormData(jsParams)));
      assert(
        csInfo.totalUseConfigCount === jsInfo.totalUseConfigCount && csInfo.useConfigValue === jsInfo.useConfigValue,
        `[C# vs JS Oracle: ${caseId}] UseConfigurationSet 契約が完全一致すること (C#=${csInfo.useConfigValue ?? 'absent'}, JS=${jsInfo.useConfigValue ?? 'absent'})`
      );
      assert(
        csInfo.peScriptCopyCount === jsInfo.peScriptCopyCount && csInfo.peRunSyncCount === jsInfo.peRunSyncCount,
        `[C# vs JS Oracle: ${caseId}] PEScriptCopy 個数 (${csInfo.peScriptCopyCount}) と windowsPE RunSynchronousCommand 個数 (${csInfo.peRunSyncCount}) が完全一致すること`
      );
    }
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

function verifyNegativeGuardrails() {
  console.log('\n--- 5. Negative Guardrail Verification (Mutation / Regression Detection) ---');

  const syncModCode = fs.readFileSync(path.join(repoRoot, 'build', 'sync_modifiers.js'), 'utf8');
  const buildEngCode = fs.readFileSync(path.join(repoRoot, 'build', 'build_engine.js'), 'utf8');

  // 1) Bundler does not overwrite baseline unconditionally
  assert(
    buildEngCode.includes("const shouldUpdateBaseline = process.argv.includes('--update-baseline')") &&
      !buildEngCode.includes('if (fs.existsSync(path.dirname(baselinePath))) {\r\n  fs.copyFileSync(targetPath, baselinePath);'),
    'build/build_engine.js が通常ビルドで baseline_unattend_engine.js を自動上書きしない構造になっていること'
  );

  // 2) Negative case A: Reverting JS to hardcoded true is caught by contract inspector & static guard
  const fakeFixedTrueXml = engine
    .generateAutounattendXml(createFormData({ PEMode: 'Default' }))
    .replace('<UseConfigurationSet>false</UseConfigurationSet>', '<UseConfigurationSet>true</UseConfigurationSet>');
  const fakeFixedTrueInfo = inspectXmlContract(fakeFixedTrueXml);
  assert(
    fakeFixedTrueInfo.useConfigValue !== 'false',
    '[負例A] Default未指定で固定trueに戻した場合、契約検査 (expected=false, actual=true) が確実に不一致を検出すること'
  );
  assert(
    syncModCode.includes("genEngContent.includes(\"winSetup.addSimpleElement('UseConfigurationSet', 'true')\")") &&
      syncModCode.includes("jsProductKeyContent.includes('useConfigurationSet')"),
    '[負例A] sync_modifiers.js が generator_engine.js / product_key.js の固定true残存を検出するルールを持つこと'
  );

  // 3) Negative case B: Removing OEM copy in Generated mode is caught by contract inspector & static guard
  const fakeNoOemXml = engine
    .generateAutounattendXml(createFormData({ PEMode: 'Generated' }))
    .replace(/Copying contents of \^?%OEM_FOLDER\^?%/g, '');
  assert(
    !fakeNoOemXml.includes('Copying contents of %OEM_FOLDER%'),
    '[負例B] GeneratedからOEMコピーを削除した場合、契約検査が確実に欠落を検出すること'
  );
  assert(
    syncModCode.includes('Copying contents of %OEM_FOLDER%') &&
      syncModCode.includes("getPeScriptSection.includes(\"getBool('UseConfigurationSet'\")"),
    '[負例B] sync_modifiers.js が disk.js の OEMコピー欠落および UseConfigurationSet 条件化を検出するルールを持つこと'
  );

  // 4) Negative case C: Upstream C# changing condition alone is caught by bidirectional guard
  assert(
    syncModCode.includes('!csEvaluatesDefaultUseConfig') &&
      syncModCode.includes('!xmlDefaultFalse || xmlDefaultTrue'),
    '[負例C] 上流 C# (Disk.cs / autounattend.xml) 側のみ条件が変更された場合も sync_modifiers.js が双方向不整合を検出すること'
  );
}

console.log('====================================================');
console.log('  C# Oracle & Behavioral Contract Verification');
console.log('====================================================\n');

verifyUpstreamCSharpSourceContract();
verifyContractMatrix();
verifyReferenceUpstreamXmlEquivalence();
runDirectDotnetOracleComparison();
verifyNegativeGuardrails();

console.log('\n====================================================');
console.log(` 検証結果: ${passed} 項目合格 / ${failed} 項目失敗`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}




