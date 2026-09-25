/**
 * 機能格差解消（Parity）＆構文不具合解消検証テスト
 * C# 実装（modifier/Bloatware.cs, modifier/Optimizations.cs 等）と JS 実装（docs/unattend_engine.js）の整合性確認
 */
const fs = require('fs');
const path = require('path');
const engine = require('../docs/unattend_engine.js');

class MockFormData {
  constructor(obj) {
    this.data = new Map(Object.entries(obj));
  }
  entries() {
    return this.data.entries();
  }
  get(key) {
    return this.data.get(key) || null;
  }
}

function runTests() {
  console.log('====================================================');
  console.log('  unattend_engine.js 機能パリティ・構文網羅テスト');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(` [FAIL] ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(` [PASS] ${message}`);
      passed++;
    }
  }

  // --- テストケース 1: スマートクォートの完全排除 ---
  console.log('--- Test 1: スマートクォート（U+2018, U+2019, U+201C, U+201D）の完全排除 ---');
  const fd1 = new MockFormData({
    LanguageMode: 'Unattended',
    UILanguage: 'ja-JP',
    Locale: 'ja-JP',
    Keyboard: '00000411',
    ShowFileExtensions: 'true',
    DisableAppSuggestions: 'true',
    RemoveCopilot: 'true',
    RemoveOneDrive: 'true'
  });
  const xml1 = engine.generateAutounattendXml(fd1);

  // スマートクォート文字検出
  const smartQuoteRegex = /[\u2018\u2019\u201C\u201D]/;
  assert(!smartQuoteRegex.test(xml1), 'XML全体および埋め込みスクリプトに全角スマートクォートが含まれていないこと');

  // Activity の文言確認
  assert(xml1.includes('Running scripts to modify default user registry hive.'), 'DefaultUserSequence の Activity 文言が引用符なし ASCII の安全な形式になっていること');
  assert(!xml1.includes("default user’s"), "旧コードの 'default user’s' が残っていないこと");

  // --- テストケース 2: DisableAppSuggestions 機能の確認 ---
  console.log('\n--- Test 2: DisableAppSuggestions（アプリ提案・消費者機能無効化）の移植確認 ---');
  assert(xml1.includes('ContentDeliveryAllowed'), 'DefaultUser.ps1 に ContentDeliveryAllowed レジストリ設定が含まれていること');
  assert(xml1.includes('SystemPaneSuggestionsEnabled'), 'DefaultUser.ps1 に SystemPaneSuggestionsEnabled レジストリ設定が含まれていること');
  assert(xml1.includes('SubscribedContent-310093Enabled'), 'DefaultUser.ps1 に SubscribedContent-310093Enabled 等の提案無効化が含まれていること');
  assert(xml1.includes('DisableWindowsConsumerFeatures'), 'Specialize.ps1 に DisableWindowsConsumerFeatures レジストリ設定が含まれていること');

  // --- テストケース 3: Bloatware 削除機能（RemovePackage.ps1）の確認 ---
  console.log('\n--- Test 3: Bloatware 削除パッケージ生成と付随レジストリ処理の確認 ---');
  const fdBloat = new MockFormData({
    RemoveBingSearch: 'true',
    RemoveOffice365: 'true',
    RemoveCopilot: 'true',
    RemoveOneDrive: 'true',
    RemoveTeams: 'true',
    RemoveXboxApps: 'true',
    RemoveWeather: 'true',
    RemoveSolitaire: 'true'
  });
  const xmlBloat = engine.generateAutounattendXml(fdBloat);

  // RemovePackage.ps1 の生成
  assert(xmlBloat.includes('RemovePackage.ps1'), 'XMLのFile要素に RemovePackage.ps1 が埋め込まれていること');
  assert(xmlBloat.includes('*Microsoft.BingSearch*'), 'RemovePackage.ps1 に BingSearch パターンが含まれていること');
  assert(xmlBloat.includes('*Microsoft.MicrosoftOfficeHub*'), 'RemovePackage.ps1 に OfficeHub パターンが含まれていること');
  assert(xmlBloat.includes('*Microsoft.BingWeather*'), 'RemovePackage.ps1 に Weather パターンが含まれていること');
  assert(xmlBloat.includes('*Microsoft.MicrosoftSolitaireCollection*'), 'RemovePackage.ps1 に Solitaire パターンが含まれていること');
  assert(xmlBloat.includes('Remove-AppxProvisionedPackage -Online -AllUsers'), 'RemovePackage.ps1 内で全ユーザー一括プロビジョニング削除が実行されていること');
  assert(xmlBloat.includes('RemovePackage.ps1'), 'Specialize.ps1 から RemovePackage.ps1 が呼び出されていること');

  // 付随スクリプト
  assert(xmlBloat.includes('TurnOffWindowsCopilot'), 'RemoveCopilot 指定時に TurnOffWindowsCopilot ポリシー設定が含まれていること');
  assert(xmlBloat.includes('Microsoft.Windows.Ai.Copilot.Provider'), 'RemoveCopilot 指定時に Copilot Provider パッケージ削除が含まれていること');
  assert(xmlBloat.includes('OneDriveSetup.exe'), 'RemoveOneDrive 指定時に OneDriveSetup.exe の削除処理が含まれていること');
  assert(xmlBloat.includes('OneDriveSetup'), 'RemoveOneDrive 指定時に Run レジストリからの削除処理が含まれていること');
  assert(xmlBloat.includes('ConfigureChatAutoInstall'), 'RemoveTeams 指定時に Teams チャット自動インストール無効化が含まれていること');
  assert(xmlBloat.includes('AppCaptureEnabled'), 'RemoveXboxApps 指定時に GameDVR AppCaptureEnabled 無効化が含まれていること');

  // --- テストケース 4: Bloatware 未選択時は RemovePackage.ps1 が生成されないこと ---
  console.log('\n--- Test 4: Bloatware 未選択時のクリーン動作確認 ---');
  const fdClean = new MockFormData({
    LanguageMode: 'Unattended',
    UILanguage: 'ja-JP'
  });
  const xmlClean = engine.generateAutounattendXml(fdClean);
  assert(!xmlClean.includes('RemovePackage.ps1'), 'Bloatware未指定時は RemovePackage.ps1 が生成されないこと');

  // --- テストケース 5: DisableFastStartup 機能の確認 ---
  console.log('\n--- Test 5: DisableFastStartup（高速スタートアップ無効化）の移植確認 ---');
  const fdFastStartup = new MockFormData({
    DisableFastStartup: 'true'
  });
  const xmlFastStartup = engine.generateAutounattendXml(fdFastStartup);
  const fastStartupCmd = 'reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f;';
  assert(xmlFastStartup.includes(fastStartupCmd), 'DisableFastStartup 指定時に Specialize.ps1 に HiberbootEnabled 無効化コマンドが含まれていること');

  const fdNoFastStartup = new MockFormData({});
  const xmlNoFastStartup = engine.generateAutounattendXml(fdNoFastStartup);
  assert(!xmlNoFastStartup.includes('HiberbootEnabled'), 'DisableFastStartup 未指定時には HiberbootEnabled 設定が含まれないこと');

  // --- テストケース 6: Build/Commit 要素のリポジトリ URL およびコミットハッシュ検証 ---
  console.log('\n--- Test 6: Build/Commit 要素のリポジトリ URL およびコミットハッシュ検証 ---');
  const fdCommit = new MockFormData({
    ShowFileExtensions: 'true'
  });
  const xmlCommit = engine.generateAutounattendXml(fdCommit);
  assert(xmlCommit.includes('<Build>'), 'Extensions 内に <Build> 要素が出力されていること');
  assert(xmlCommit.includes('<Commit>'), '<Build> 内に <Commit> 要素が出力されていること');
  assert(xmlCommit.includes('https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP/commit/'), 'GitHubUrl が本リポジトリ (CTD-Networks-CO-LTD/unattend-generator_ja-JP) を指していること');
  assert(!xmlCommit.includes('https://github.com/cschneegans/unattend-generator/commit/'), 'フォーク元 (cschneegans) の URL が残っていないこと');

  // --- テストケース 7: ヘッダーのコミット情報・リリース情報および動的相対時間の検証 ---
  console.log('\n--- Test 7: ヘッダーのコミット情報・リリース情報および動的相対時間の検証 ---');
  const headerHtmlPath = path.join(__dirname, '..', 'docs', 'sections', 'header.html');
  assert(fs.existsSync(headerHtmlPath), 'docs/sections/header.html が存在すること');
  const headerHtml = fs.readFileSync(headerHtmlPath, 'utf8');

  // 説明文
  assert(headerHtml.includes('This service lets you create'), 'header.html に説明文が含まれていること');
  assert(headerHtml.includes('class="Centered"'), 'header.html に class="Centered" 段落が含まれていること');

  // 自リポジトリURLの指向確認
  assert(headerHtml.includes('https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP'), 'header.html の GitHub リンクが自リポジトリを指していること');
  assert(!headerHtml.includes('https://github.com/cschneegans/unattend-generator'), 'header.html にフォーク元 (cschneegans) の URL が残っていないこと');

  // Release および Commit リンク
  assert(headerHtml.includes('id="header-release-link"'), 'header.html に Release リンク (id="header-release-link") が含まれていること');
  assert(headerHtml.includes('/releases/tag/'), 'header.html の Release リンクが tag URL を指していること');
  assert(headerHtml.includes('id="header-commit-link"'), 'header.html に Commit リンク (id="header-commit-link") が含まれていること');
  assert(headerHtml.includes('/commit/'), 'header.html の Commit リンクが commit URL を指していること');
  assert(headerHtml.includes('id="header-commit-time"'), 'header.html に Commit 時間表示要素 (id="header-commit-time") が含まれていること');
  assert(headerHtml.includes('data-commit-date='), 'header.html の Commit 時間要素に data-commit-date 属性が付与されていること');

  // 除外項目が含まれていないこと
  assert(!headerHtml.includes('/windows/unattend-generator/usage/'), 'header.html に不要リンク Usage が含まれていないこと');
  assert(!headerHtml.includes('/windows/unattend-generator/samples/'), 'header.html に不要リンク Samples が含まれていないこと');
  assert(!headerHtml.includes('paypal.me'), 'header.html に不要リンク PayPal が含まれていないこと');
  assert(!headerHtml.includes('buymeacoffee.com'), 'header.html に不要リンク Buy Me a Coffee が含まれていないこと');

  // 動的相対時間計算ロジックの検証
  assert(typeof engine.formatRelativeTime === 'function', 'engine.formatRelativeTime 関数が公開されていること');
  const baseNow = new Date('2026-09-19T12:00:00Z');
  const dJustNow = new Date(baseNow.getTime() - 30 * 1000);
  const d1Min = new Date(baseNow.getTime() - 65 * 1000);
  const d5Min = new Date(baseNow.getTime() - 5 * 60 * 1000);
  const d1Hour = new Date(baseNow.getTime() - 70 * 60 * 1000);
  const d3Hours = new Date(baseNow.getTime() - 3 * 3600 * 1000);
  const d1Day = new Date(baseNow.getTime() - 25 * 3600 * 1000);
  const d5Days = new Date(baseNow.getTime() - 5 * 86400 * 1000);
  const d1Month = new Date(baseNow.getTime() - 35 * 86400 * 1000);
  const d3Months = new Date(baseNow.getTime() - 100 * 86400 * 1000);
  const d1Year = new Date(baseNow.getTime() - 400 * 86400 * 1000);
  const d2Years = new Date(baseNow.getTime() - 800 * 86400 * 1000);

  assert(engine.formatRelativeTime(dJustNow, baseNow) === 'just now', '30秒前が "just now" とフォーマットされること');
  assert(engine.formatRelativeTime(d1Min, baseNow) === 'updated 1 minute ago', '1分前が "updated 1 minute ago" とフォーマットされること');
  assert(engine.formatRelativeTime(d5Min, baseNow) === 'updated 5 minutes ago', '5分前が "updated 5 minutes ago" とフォーマットされること');
  assert(engine.formatRelativeTime(d1Hour, baseNow) === 'updated 1 hour ago', '1時間前が "updated 1 hour ago" とフォーマットされること');
  assert(engine.formatRelativeTime(d3Hours, baseNow) === 'updated 3 hours ago', '3時間前が "updated 3 hours ago" とフォーマットされること');
  assert(engine.formatRelativeTime(d1Day, baseNow) === 'updated 1 day ago', '1日前が "updated 1 day ago" とフォーマットされること');
  assert(engine.formatRelativeTime(d5Days, baseNow) === 'updated 5 days ago', '5日前が "updated 5 days ago" とフォーマットされること');
  assert(engine.formatRelativeTime(d1Month, baseNow) === 'updated 1 month ago', '1ヶ月前が "updated 1 month ago" とフォーマットされること');
  assert(engine.formatRelativeTime(d3Months, baseNow) === 'updated 3 months ago', '3ヶ月前が "updated 3 months ago" とフォーマットされること');
  assert(engine.formatRelativeTime(d1Year, baseNow) === 'updated 1 year ago', '1年前が "updated 1 year ago" とフォーマットされること');
  assert(engine.formatRelativeTime(d2Years, baseNow) === 'updated 2 years ago', '2年前が "updated 2 years ago" とフォーマットされること');

  // --- Test 8: カスタムスクリプト（全フェーズ・全形式・通番・Reg補完・RestartExplorer・実行順序）の検証 ---
  console.log('\n--- Test 8: カスタムスクリプト（全フェーズ・全形式・通番・Reg補完・RestartExplorer・実行順序）の検証 ---');
  const customScriptFd = new MockFormData({
    UserAccountMode: 'Unattended',
    AutoLogonMode: 'Own',
    AutoLogonUsername: 'adminuser',
    AutoLogonPassword: 'Passw0rd123!',
    SystemScript0: 'echo SystemScript Cmd',
    SystemScriptType0: 'Cmd',
    DefaultUserScript0: '[HKEY_USERS\\DefaultUser\\Software\\MyApp]\r\n"Setting"=dword:00000001',
    DefaultUserScriptType0: 'Reg',
    FirstLogonScript0: 'Write-Host "FirstLogon Ps1"',
    FirstLogonScriptType0: 'Ps1',
    UserOnceScript0: 'MsgBox "UserOnce Vbs"',
    UserOnceScriptType0: 'Vbs',
    UserOnceScript1: 'WScript.Echo("UserOnce Js");',
    UserOnceScriptType1: 'Js',
    RestartExplorer: 'true'
  });
  const customScriptXml = engine.generateAutounattendXml(customScriptFd);

  // 1. 各ファイルが Extensions 内に正しく埋め込まれていること
  assert(customScriptXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-01.cmd">'), 'unattend-01.cmd が File 要素として埋め込まれていること');
  assert(customScriptXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-02.reg">'), 'unattend-02.reg が File 要素として埋め込まれていること');
  assert(customScriptXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-03.ps1">'), 'unattend-03.ps1 が File 要素として埋め込まれていること');
  assert(customScriptXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-04.vbs">'), 'unattend-04.vbs が File 要素として埋め込まれていること');
  assert(customScriptXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-05.js">'), 'unattend-05.js が File 要素として埋め込まれていること');

  // 2. Reg ファイルのヘッダー自動補完
  assert(customScriptXml.includes('Windows Registry Editor Version 5.00\r\n\r\n[HKEY_USERS\\DefaultUser\\Software\\MyApp]'), 'unattend-02.reg に Windows Registry Editor Version 5.00 ヘッダーが自動補完されていること');

  // 3. 各スクリプトシーケンス内の呼び出しコマンド
  assert(customScriptXml.includes('C:\\Windows\\Setup\\Scripts\\unattend-01.cmd;'), 'Specialize.ps1 に unattend-01.cmd 実行コマンドが含まれていること');
  assert(customScriptXml.includes('reg.exe import "C:\\Windows\\Setup\\Scripts\\unattend-02.reg";'), 'DefaultUser.ps1 に reg.exe import 実行コマンドが含まれていること');
  assert(customScriptXml.includes("&amp; 'C:\\Windows\\Setup\\Scripts\\unattend-03.ps1';"), 'FirstLogon.ps1 に unattend-03.ps1 実行コマンドが含まれていること');
  assert(customScriptXml.includes('cscript.exe //E:vbscript "C:\\Windows\\Setup\\Scripts\\unattend-04.vbs";'), 'UserOnce.ps1 に unattend-04.vbs 実行コマンドが含まれていること');
  assert(customScriptXml.includes('cscript.exe //E:jscript "C:\\Windows\\Setup\\Scripts\\unattend-05.js";'), 'UserOnce.ps1 に unattend-05.js 実行コマンドが含まれていること');

  // 4. FirstLogon.ps1 内の実行順序整合性（カスタムスクリプトが Remove-Item より前にあること）
  const idxScriptCall = customScriptXml.indexOf("&amp; 'C:\\Windows\\Setup\\Scripts\\unattend-03.ps1';");
  const idxRemoveItem = customScriptXml.indexOf('Remove-Item -LiteralPath @(');
  assert(idxScriptCall !== -1 && idxRemoveItem !== -1 && idxScriptCall < idxRemoveItem, 'FirstLogon.ps1 内でカスタムスクリプト呼び出しが Remove-Item (敏感ファイル削除) より前に配置されていること');

  // 5. RestartExplorer による explorer 再起動ブロックの出力
  assert(customScriptXml.includes("Get-Process -Name 'explorer' -ErrorAction 'SilentlyContinue'"), 'RestartExplorer 有効時に explorer 再起動ブロックが UserOnce.ps1 に含まれていること');

  // 6. カスタムスクリプト未入力時のクリーン動作
  const cleanFd = new MockFormData({});
  const cleanXml = engine.generateAutounattendXml(cleanFd);
  assert(!cleanXml.includes('unattend-01'), 'カスタムスクリプト未入力時には unattend-01.* が生成されないこと');

  // --- Test 9: AppLocker ポリシー設定の検証 ---
  console.log('\n--- Test 9: AppLocker ポリシー設定の検証 ---');
  const samplePolicyXml = '<AppLockerPolicy Version="1">\r\n  <RuleCollection Type="Exe" EnforcementMode="Enabled">\r\n    <FilePathRule Id="12345" Name="Allow Program Files" Action="Allow">\r\n      <Conditions>\r\n        <FilePathCondition Path="%PROGRAMFILES%\\*" />\r\n      </Conditions>\r\n    </FilePathRule>\r\n  </RuleCollection>\r\n</AppLockerPolicy>';
  const appLockerFd = new MockFormData({
    AppLockerMode: 'Configure',
    AppLockerPolicyXml: samplePolicyXml
  });
  const appLockerXml = engine.generateAutounattendXml(appLockerFd);

  assert(appLockerXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\AppLockerPolicy.xml">'), 'AppLockerPolicy.xml が File 要素として埋め込まれていること');
  assert(appLockerXml.includes('&lt;AppLockerPolicy Version="1"&gt;'), 'AppLockerPolicy.xml の内容がエスケープされて埋め込まれていること');
  assert(appLockerXml.includes("Get-Service -Name 'AppIDSvc' | Set-Service -StartupType 'Automatic';"), 'Specialize.ps1 に AppIDSvc 自動起動コマンドが含まれていること');
  assert(appLockerXml.includes("Get-Service -Name 'AppIDSvc' | Start-Service;"), 'Specialize.ps1 に AppIDSvc 開始コマンドが含まれていること');
  assert(appLockerXml.includes("Set-AppLockerPolicy -XmlPolicy 'C:\\Windows\\Setup\\Scripts\\AppLockerPolicy.xml';"), 'Specialize.ps1 に Set-AppLockerPolicy 実行コマンドが含まれていること');

  // AppLockerMode = Skip のとき何も出力されないこと
  const appLockerSkipFd = new MockFormData({
    AppLockerMode: 'Skip',
    AppLockerPolicyXml: samplePolicyXml
  });
  const appLockerSkipXml = engine.generateAutounattendXml(appLockerSkipFd);
  assert(!appLockerSkipXml.includes('AppLockerPolicy.xml'), 'AppLockerMode: Skip 時に AppLockerPolicy.xml が生成されないこと');
  assert(!appLockerSkipXml.includes('AppIDSvc'), 'AppLockerMode: Skip 時に AppIDSvc コマンドが含まれないこと');

  // --- Test 10: 追加コンポーネント XML (ComponentsModifier) の検証 ---
  console.log('\n--- Test 10: 追加コンポーネント XML (ComponentsModifier) の検証 ---');
  const compFd = new MockFormData({
    Component0: 'Microsoft-Windows-Audio-AudioCore-specialize',
    ComponentContent0: '<AudioSetting action="enable"><Volume>80</Volume></AudioSetting>',
    Component1: 'Microsoft-Windows-CodeIntegrity-offlineServicing',
    ComponentContent1: '<Data>TestVal</Data>'
  });
  const compXml = engine.generateAutounattendXml(compFd);

  assert(compXml.includes('<settings pass="specialize">'), 'specialize pass が存在すること');
  assert(compXml.includes('<component name="Microsoft-Windows-Audio-AudioCore" processorArchitecture="x86" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">'), 'specialize pass に Microsoft-Windows-Audio-AudioCore コンポーネントが生成されていること');
  assert(compXml.includes('<AudioSetting action="enable">'), '注入された <AudioSetting> 要素が出力されていること');
  assert(compXml.includes('<Volume>80</Volume>'), '注入された <Volume> 要素が出力されていること');

  assert(compXml.includes('<settings pass="offlineServicing">'), 'offlineServicing pass が存在すること');
  assert(compXml.includes('<component name="Microsoft-Windows-CodeIntegrity" processorArchitecture="x86" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">'), 'offlineServicing pass に Microsoft-Windows-CodeIntegrity コンポーネントが生成されていること');
  assert(compXml.includes('<Data>TestVal</Data>'), '注入された <Data> 要素が出力されていること');

  // 禁止要素（settings や component）を含む場合はスキップされること
  const forbiddenFd = new MockFormData({
    Component0: 'Microsoft-Windows-Audio-AudioCore-specialize',
    ComponentContent0: '<settings><sub/></settings>'
  });
  const forbiddenXml = engine.generateAutounattendXml(forbiddenFd);
  assert(!forbiddenXml.includes('<sub/>'), '禁止要素 <settings> を含むコンポーネントマークアップは注入されないこと');

  // --- Test 11: スタートピン留め (StartPinsJson) の検証 ---
  console.log('\n--- Test 11: スタートピン留め (StartPinsJson) の検証 ---');
  const samplePinsJson = '{"pinnedList":[{"packageId":"Microsoft.WindowsTerminal_8wekyb3d8bbwe!App"}]}';
  const startPinsFd = new MockFormData({
    StartPinsMode: 'Custom',
    StartPinsJson: samplePinsJson
  });
  const startPinsXml = engine.generateAutounattendXml(startPinsFd);
  assert(startPinsXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\SetStartPins.ps1">'), 'SetStartPins.ps1 が File 要素として埋め込まれていること');
  assert(startPinsXml.includes('Microsoft.WindowsTerminal'), 'SetStartPins.ps1 に指定 JSON の内容が含まれていること');
  assert(startPinsXml.includes("&amp; 'C:\\Windows\\Setup\\Scripts\\SetStartPins.ps1';"), 'Specialize.ps1 から SetStartPins.ps1 が呼び出されていること');

  // Empty 指定時
  const emptyPinsFd = new MockFormData({
    StartPinsMode: 'Empty'
  });
  const emptyPinsXml = engine.generateAutounattendXml(emptyPinsFd);
  assert(emptyPinsXml.includes('{"pinnedList":[]}'), 'StartPinsMode: Empty 時に空ピンリストが出力されること');

  // Default 指定時
  const defaultPinsFd = new MockFormData({
    StartPinsMode: 'Default'
  });
  const defaultPinsXml = engine.generateAutounattendXml(defaultPinsFd);
  assert(!defaultPinsXml.includes('SetStartPins.ps1'), 'StartPinsMode: Default 時に SetStartPins.ps1 が出力されないこと');

  // --- Test 12: タスクバーアイコン (TaskbarIconsXml) の検証 ---
  console.log('\n--- Test 12: タスクバーアイコン (TaskbarIconsXml) の検証 ---');
  const sampleTaskbarXml = '<CustomTaskbarLayoutCollection PinListPlacement="Replace"><defaultlayout:TaskbarLayout><taskbar:TaskbarPinList><taskbar:DesktopApp DesktopApplicationLinkPath="%PROGRAMFILES%\\Test.lnk" /></taskbar:TaskbarPinList></defaultlayout:TaskbarLayout></CustomTaskbarLayoutCollection>';
  const taskbarFd = new MockFormData({
    TaskbarIconsMode: 'Custom',
    TaskbarIconsXml: sampleTaskbarXml
  });
  const taskbarXml = engine.generateAutounattendXml(taskbarFd);
  assert(taskbarXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\TaskbarLayoutModification.xml">'), 'TaskbarLayoutModification.xml が File 要素として埋め込まれていること');
  assert(taskbarXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\UnlockStartLayout.vbs">'), 'UnlockStartLayout.vbs が File 要素として埋め込まれていること');
  assert(taskbarXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\UnlockStartLayout.xml">'), 'UnlockStartLayout.xml が File 要素として埋め込まれていること');
  assert(taskbarXml.includes('DisableCloudOptimizedContent'), 'Specialize.ps1 に DisableCloudOptimizedContent ポリシー設定が含まれていること');
  assert(taskbarXml.includes('StartLayoutFile'), 'DefaultUser.ps1 に StartLayoutFile レジストリ設定が含まれていること');
  assert(taskbarXml.includes('LockedStartLayout'), 'DefaultUser.ps1 に LockedStartLayout レジストリ設定が含まれていること');
  assert(taskbarXml.includes("Register-ScheduledTask -TaskName 'UnlockStartLayout'"), 'Specialize.ps1 にタスクスケジューラ登録が含まれていること');
  assert(taskbarXml.includes("[System.Diagnostics.EventLog]::WriteEntry( 'UnattendGenerator'"), 'UserOnce.ps1 にイベントログ書き込みが含まれていること');

  // Empty 指定時
  const emptyTaskbarFd = new MockFormData({
    TaskbarIconsMode: 'Empty'
  });
  const emptyTaskbarXml = engine.generateAutounattendXml(emptyTaskbarFd);
  assert(emptyTaskbarXml.includes('#leaveempty'), 'TaskbarIconsMode: Empty 時に #leaveempty 要素が含まれること');

  // Default 指定時
  const defaultTaskbarFd = new MockFormData({
    TaskbarIconsMode: 'Default'
  });
  const defaultTaskbarXml = engine.generateAutounattendXml(defaultTaskbarFd);
  assert(!defaultTaskbarXml.includes('TaskbarLayoutModification.xml'), 'TaskbarIconsMode: Default 時に TaskbarLayoutModification.xml が出力されないこと');

  // --- Test 13: デスクトップ壁紙・ロック画面画像 (WallpaperScript, LockScreenScript) の検証 ---
  console.log('\n--- Test 13: デスクトップ壁紙・ロック画面画像 の検証 ---');
  const personalizationFd = new MockFormData({
    WallpaperMode: 'Script',
    WallpaperScript: '$url = "https://example.com/wp.jpg"; ( Invoke-WebRequest -Uri $url ).Content;',
    LockScreenMode: 'Script',
    LockScreenScript: '[System.IO.File]::ReadAllBytes("D:\\lock.png");'
  });
  const personalizationXml = engine.generateAutounattendXml(personalizationFd);
  assert(personalizationXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\GetWallpaper.ps1">'), 'GetWallpaper.ps1 が File 要素として埋め込まれていること');
  assert(personalizationXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\SetWallpaper.ps1">'), 'SetWallpaper.ps1 が File 要素として埋め込まれていること');
  assert(personalizationXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\GetLockScreenImage.ps1">'), 'GetLockScreenImage.ps1 が File 要素として埋め込まれていること');
  assert(personalizationXml.includes("C:\\Windows\\Setup\\Scripts\\Wallpaper"), 'Specialize.ps1 に壁紙バイナリ保存処理が含まれていること');
  assert(personalizationXml.includes("Set-WallpaperImage -LiteralPath 'C:\\Windows\\Setup\\Scripts\\Wallpaper';"), 'SetWallpaper.ps1 末尾に Set-WallpaperImage 呼び出しが含まれていること');
  assert(personalizationXml.includes("&amp; 'C:\\Windows\\Setup\\Scripts\\SetWallpaper.ps1';"), 'UserOnce.ps1 から SetWallpaper.ps1 が呼び出されていること');
  assert(personalizationXml.includes('LockScreenImagePath'), 'Specialize.ps1 に LockScreenImagePath レジストリ設定が含まれていること');

  // Default 指定時
  const defaultPersonalizationFd = new MockFormData({
    WallpaperMode: 'Default',
    LockScreenMode: 'Default'
  });
  const defaultPersonalizationXml = engine.generateAutounattendXml(defaultPersonalizationFd);
  assert(!defaultPersonalizationXml.includes('GetWallpaper.ps1'), 'WallpaperMode: Default 時に GetWallpaper.ps1 が出力されないこと');
  assert(!defaultPersonalizationXml.includes('GetLockScreenImage.ps1'), 'LockScreenMode: Default 時に GetLockScreenImage.ps1 が出力されないこと');

  // --- Test 14: Wi-Fi プロファイル (WifiProfileXml / HideWirelessSetupInOOBE) の検証 ---
  console.log('\n--- Test 14: Wi-Fi プロファイル (WifiProfileXml / HideWirelessSetupInOOBE) の検証 ---');
  const sampleWifiXml = '<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>Office-WiFi</name><connectionType>ESS</connectionType><connectionMode>auto</connectionMode></WLANProfile>';
  const wifiProfileFd = new MockFormData({
    WifiMode: 'FromProfile',
    WifiProfileXml: sampleWifiXml
  });
  const wifiProfileXml = engine.generateAutounattendXml(wifiProfileFd);

  assert(wifiProfileXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\Wifi.xml">'), 'Wifi.xml が File 要素として埋め込まれていること');
  assert(wifiProfileXml.includes("Waiting for service '${name}' to start."), 'Specialize.ps1 に WlanSvc 待機ループスクリプトが含まれていること');
  assert(wifiProfileXml.includes('netsh.exe wlan add profile filename="C:\\Windows\\Setup\\Scripts\\Wifi.xml" user=all;'), 'Specialize.ps1 に netsh profile 追加コマンドが含まれていること');
  assert(wifiProfileXml.includes('netsh.exe wlan connect name="Office-WiFi" ssid="Office-WiFi";'), 'Specialize.ps1 に auto 接続コマンドが含まれていること');
  assert(!wifiProfileXml.includes('HideWirelessSetupInOOBE'), 'WifiMode: FromProfile 時に HideWirelessSetupInOOBE 要素が出力されないこと（削除）');

  // WifiMode = Skip 指定時
  const wifiSkipFd = new MockFormData({
    WifiMode: 'Skip'
  });
  const wifiSkipXml = engine.generateAutounattendXml(wifiSkipFd);
  assert(wifiSkipXml.includes('<HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>'), 'WifiMode: Skip 時に HideWirelessSetupInOOBE が true であること');
  assert(!wifiSkipXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\Wifi.xml">'), 'WifiMode: Skip 時に Wifi.xml が埋め込まれないこと');

  // WifiMode = Interactive 指定時
  const wifiInteractiveFd = new MockFormData({
    WifiMode: 'Interactive'
  });
  const wifiInteractiveXml = engine.generateAutounattendXml(wifiInteractiveFd);
  assert(wifiInteractiveXml.includes('<HideWirelessSetupInOOBE>false</HideWirelessSetupInOOBE>'), 'WifiMode: Interactive 時に HideWirelessSetupInOOBE が false であること');
  assert(!wifiInteractiveXml.includes('<File path="C:\\Windows\\Setup\\Scripts\\Wifi.xml">'), 'WifiMode: Interactive 時に Wifi.xml が埋め込まれないこと');

  // --- Test 15: PE ステージスクリプト群 (PEScript, DiskpartScript, TargetDiskScript) の検証 ---
  console.log('\n--- Test 15: PE ステージスクリプト群 (PEScript, DiskpartScript, TargetDiskScript) の検証 ---');

  // Case A: PEMode = 'Script'
  const customPeFd = new MockFormData({
    PEMode: 'Script',
    PEScript: '@echo off\r\necho Custom PE Script Running\r\nwpeutil reboot'
  });
  const customPeXml = engine.generateAutounattendXml(customPeFd);
  assert(customPeXml.includes('&gt;&gt;X:\\pe.cmd (echo:@echo off'), 'windowsPE 内に X:\\pe.cmd 書出コマンドが存在すること');
  assert(customPeXml.includes('cmd.exe /c "X:\\pe.cmd"'), 'windowsPE 内に X:\\pe.cmd 実行コマンドが存在すること');
  assert(customPeXml.includes('<PEScriptCopy>'), 'Extensions 内に PEScriptCopy 要素が存在すること');
  assert(customPeXml.includes('Custom PE Script Running'), 'PEScriptCopy 内に入力スクリプトが埋め込まれていること');

  // Case B: PEMode = 'Generated', TargetDiskMode = 'Script', PartitionMode = 'Custom'
  const generatedPeFd = new MockFormData({
    PEMode: 'Generated',
    TargetDiskMode: 'Script',
    TargetDiskScript: 'WScript.Echo 0\r\nWScript.Quit 0',
    PartitionMode: 'Custom',
    DiskpartScript: 'SELECT DISK=0\r\nCLEAN\r\nASSIGN LETTER=S\r\nASSIGN LETTER=W'
  });
  const generatedPeXml = engine.generateAutounattendXml(generatedPeFd);
  assert(generatedPeXml.includes('&gt;&gt;X:\\pe.cmd'), 'windowsPE 内に pe.cmd 作成コマンドが存在すること');
  assert(generatedPeXml.includes('&gt;X:\\target.vbs'), 'pe.cmd 内に target.vbs 出力処理が含まれていること');
  assert(generatedPeXml.includes('&gt;X:\\diskpart.txt'), 'pe.cmd 内に diskpart.txt 出力処理が含まれていること');
  assert(generatedPeXml.includes('diskpart.exe /s X:\\diskpart.txt'), 'pe.cmd 内に diskpart.exe /s 実行処理が含まれていること');
  assert(generatedPeXml.includes('<PEScriptCopy>'), 'Extensions 内に PEScriptCopy が出力されていること');

  // Case C: PEMode = 'Generated' (Default Settings: Automatic + Generated TargetDisk + Edition Pro + GeoID 244)
  const defaultGenFd = new MockFormData({
    PEMode: 'Generated',
    LanguageMode: 'Unattended',
    GeoLocation: '244',
    TargetDiskMode: 'Generated',
    TargetDiskInterfaceType: 'true',
    TargetDiskMediaType: 'true',
    TargetDiskSize: 'true',
    TargetDiskMinSize: '100',
    TargetDiskMaxSize: '4000',
    TargetDiskIndex: 'true',
    TargetDisk: '0',
    TargetDiskNoPartitions: 'true',
    PartitionMode: 'Unattended',
    PartitionLayout: 'Automatic',
    SystemSize: '300',
    RecoveryMode: 'Partition',
    RecoverySize: '1000',
    InstallFromMode: 'Edition',
    InstallFromEdition: 'pro'
  });
  const defaultGenXml = engine.generateAutounattendXml(defaultGenFd);
  assert(defaultGenXml.includes('&gt;&gt;X:\\pe.cmd'), 'PEMode: Generated (Default) 時に pe.cmd 作成コマンドが存在すること');
  assert(defaultGenXml.includes('target.vbs'), 'PEMode: Generated (Default) 時に target.vbs 出力処理が存在すること');
  assert(defaultGenXml.includes('Win32_DiskDrive'), 'target.vbs 内に WMI Win32_DiskDrive 判定が存在すること');
  assert(defaultGenXml.includes('Fixed hard disk media'), 'target.vbs 内に Fixed hard disk media チェックが存在すること');
  assert(defaultGenXml.includes('wpeutil.exe UpdateBootInfo'), 'pe.cmd 内に UpdateBootInfo 判定が存在すること');
  assert(defaultGenXml.includes('PEFirmwareType'), 'pe.cmd 内に PEFirmwareType 判定が存在すること');
  assert(defaultGenXml.includes('&gt;X:\\GPT.txt'), 'pe.cmd 内に GPT.txt 出力処理が存在すること');
  assert(defaultGenXml.includes('&gt;X:\\MBR.txt'), 'pe.cmd 内に MBR.txt 出力処理が存在すること');
  assert(defaultGenXml.includes('diskpart.exe /s X:\\%LAYOUT%.txt'), 'pe.cmd 内に動的レイアウト指定での diskpart 実行が存在すること');
  assert(defaultGenXml.includes('Windows %OS_VERSION% Pro'), 'pe.cmd 内にエディション Pro 適用パラメータが存在すること');
  assert(defaultGenXml.includes('bcdboot.exe W:\\Windows /s S:'), 'pe.cmd 内に bcdboot コマンドが存在すること');
  assert(defaultGenXml.includes('bcdedit.exe /set {fwbootmgr} bootsequence {bootmgr}'), 'pe.cmd 内に GPT時 bcdedit 設定が存在すること');
  assert(defaultGenXml.includes('DeviceRegion'), 'pe.cmd 内に DeviceRegion (GeoID 244) 設定が存在すること');
  const peMatch = defaultGenXml.match(/<settings pass="windowsPE">[\s\S]*?<\/settings>/);
  assert(peMatch !== null, 'PEMode: Generated 時に windowsPE パスが存在すること');
  const cmdMatches = peMatch[0].match(/<RunSynchronousCommand/g);
  assert(cmdMatches && cmdMatches.length === 36, 'windowsPE の RunSynchronousCommand が正確に 36 個出力されること (実際: ' + (cmdMatches ? cmdMatches.length : 0) + ')');

  // Case D: PEMode = 'Default'
  const defaultPeFd = new MockFormData({
    PEMode: 'Default'
  });
  const defaultPeXml = engine.generateAutounattendXml(defaultPeFd);
  assert(!defaultPeXml.includes('<PEScriptCopy>'), 'PEMode: Default 時に PEScriptCopy が出力されないこと');
  assert(!defaultPeXml.includes('X:\\pe.cmd'), 'PEMode: Default 時に X:\\pe.cmd が出力されないこと');

  // Case E: PEMode = 'Generated' with Partial TargetDisk criteria (Only InterfaceType & Size specified)
  const partialGenFd = new MockFormData({
    PEMode: 'Generated',
    LanguageMode: 'Unattended',
    UILanguage: 'ja-JP',
    Locale: 'ja-JP',
    Keyboard: '00000411',
    GeoLocation: '122',
    TargetDiskMode: 'Generated',
    TargetDiskInterfaceType: 'true',
    TargetDiskSize: 'true',
    TargetDiskMinSize: '63',
    TargetDiskMaxSize: '99000',
    PartitionMode: 'Unattended',
    PartitionLayout: 'Automatic',
    SystemSize: '300',
    RecoveryMode: 'Partition',
    RecoverySize: '1000',
    InstallFromMode: 'Edition',
    InstallFromEdition: 'pro'
  });
  const partialGenXml = engine.generateAutounattendXml(partialGenFd);
  assert(partialGenXml.includes('actual = drive.InterfaceType'), 'target.vbs 内に InterfaceType 判定が含まれること');
  assert(partialGenXml.includes('expected = 63'), 'target.vbs 内に MinSize 63 判定が含まれること');
  assert(partialGenXml.includes('expected = 99000'), 'target.vbs 内に MaxSize 99000 判定が含まれること');
  assert(!partialGenXml.includes('Fixed hard disk media'), 'target.vbs 内に未指定の MediaType 判定が含まれないこと');
  assert(!partialGenXml.includes('actual = drive.Index'), 'target.vbs 内に未指定の Index 判定が含まれないこと');
  assert(!partialGenXml.includes('actual = drive.Partitions'), 'target.vbs 内に未指定の Partitions 判定が含まれないこと');
  assert(partialGenXml.includes('bcdedit.exe /set {fwbootmgr} bootsequence {bootmgr} || call :fail "bcdedit.exe encountered an error."'), 'pe.cmd 内に bcdedit エラーハンドリングが存在すること');
  const partialPeMatch = partialGenXml.match(/<settings pass="windowsPE">[\s\S]*?<\/settings>/);
  assert(partialPeMatch !== null, 'windowsPE パスが存在すること');
  const partialCmdMatches = partialPeMatch[0].match(/<RunSynchronousCommand/g);
  assert(partialCmdMatches && partialCmdMatches.length === 34, 'windowsPE の RunSynchronousCommand が正確に 34 個出力されること (実際: ' + (partialCmdMatches ? partialCmdMatches.length : 0) + ')');

  console.log('\n--- Test 16: specialize パス RunSynchronousCommand (Order 1〜5) & PEScriptCopy 階層パリティの検証 ---');
  const parityParams = new URLSearchParams({
    LanguageMode: 'Unattended',
    UILanguage: 'ja-JP',
    Locale: 'ja-JP',
    Keyboard: '00000411',
    GeoLocation: '122',
    PEMode: 'Generated',
    InstallFromMode: 'Edition',
    InstallFromEdition: 'pro',
    ComputerNameMode: 'Random',
    TimeZoneMode: 'Implicit',
    UserAccountMode: 'Unattended',
    AccountName0: 'admin',
    AccountPassword0: 'Pass123!',
    AccountGroup0: 'Administrators',
    AutoLogonMode: 'Own',
    PasswordExpirationMode: 'Unlimited',
    LockoutMode: 'Default',
    HideFiles: 'Hidden',
    ShowFileExtensions: 'true',
    DisableFastStartup: 'true',
    DisableAppSuggestions: 'true',
    PreventDeviceEncryption: 'true',
    HideEdgeFre: 'true',
    WifiMode: 'Skip',
    ExpressSettings: 'DisableAll',
    RemoveBingSearch: 'true',
    RemoveCopilot: 'true',
    FirstLogonScript0: 'Write-Host "Test"',
    FirstLogonScriptType0: 'Ps1'
  });
  const parityXml = engine.generateAutounattendXml(parityParams);

  // 1. specialize RunSynchronousCommand Orders
  assert(parityXml.includes('<Order>1</Order>\r\n\t\t\t\t\t<Path>powershell.exe -WindowStyle "Normal" -NoProfile -Command "$xml = [xml]::new(); $xml.Load(\'C:\\Windows\\Panther\\unattend.xml\'); $sb = [scriptblock]::Create( $xml.unattend.Extensions.ExtractScript ); Invoke-Command -ScriptBlock $sb -ArgumentList $xml;"</Path>'), 'Order 1 が ExtractScript であること');
  assert(parityXml.includes('<Order>2</Order>\r\n\t\t\t\t\t<Path>powershell.exe -WindowStyle "Normal" -ExecutionPolicy "Unrestricted" -NoProfile -File "C:\\Windows\\Setup\\Scripts\\Specialize.ps1"</Path>'), 'Order 2 が Specialize.ps1 であること');
  assert(parityXml.includes('<Order>3</Order>\r\n\t\t\t\t\t<Path>reg.exe load "HKU\\DefaultUser" "C:\\Users\\Default\\NTUSER.DAT"</Path>'), 'Order 3 が reg.exe load であること');
  assert(parityXml.includes('<Order>4</Order>\r\n\t\t\t\t\t<Path>powershell.exe -WindowStyle "Normal" -ExecutionPolicy "Unrestricted" -NoProfile -File "C:\\Windows\\Setup\\Scripts\\DefaultUser.ps1"</Path>'), 'Order 4 が DefaultUser.ps1 であること');
  assert(parityXml.includes('<Order>5</Order>\r\n\t\t\t\t\t<Path>reg.exe unload "HKU\\DefaultUser"</Path>'), 'Order 5 が reg.exe unload であること');

  // 2. Specialize.ps1 クリーン性
  const pSpecMatch = parityXml.match(/<File path="C:\\Windows\\Setup\\Scripts\\Specialize\.ps1">([\s\S]*?)<\/File>/);
  assert(pSpecMatch, 'Specialize.ps1 が File 要素として存在すること');
  assert(!pSpecMatch[1].includes('reg.exe load "HKU\\DefaultUser"'), 'Specialize.ps1 に reg.exe load が含まれないこと');
  assert(!pSpecMatch[1].includes('DefaultUser.ps1'), 'Specialize.ps1 に DefaultUser.ps1 の呼出が含まれないこと');

  // 3. PEScriptCopy が <Build> 内に存在すること
  const pBuildMatch = parityXml.match(/<Build>([\s\S]*?)<\/Build>/);
  assert(pBuildMatch, '<Build> 要素が存在すること');
  assert(pBuildMatch[1].includes('<PEScriptCopy>'), '<Build> 内部に <PEScriptCopy> が存在すること');

  // 4. Extensions 要素順序
  const pBuildIdx = parityXml.indexOf('<Build>');
  const pExtractIdx = parityXml.indexOf('<ExtractScript>');
  const pFirstFileIdx = parityXml.indexOf('<File path=');
  assert(pBuildIdx < pExtractIdx, '<Build> が <ExtractScript> より前にあること');
  assert(pExtractIdx < pFirstFileIdx, '<ExtractScript> が 最初の <File> より前にあること');

  // 5. File 要素順序
  const pSpecFileIdx = parityXml.indexOf('<File path="C:\\Windows\\Setup\\Scripts\\Specialize.ps1">');
  const pUserOnceFileIdx = parityXml.indexOf('<File path="C:\\Windows\\Setup\\Scripts\\UserOnce.ps1">');
  const pDefUserFileIdx = parityXml.indexOf('<File path="C:\\Windows\\Setup\\Scripts\\DefaultUser.ps1">');
  const pFirstLogonFileIdx = parityXml.indexOf('<File path="C:\\Windows\\Setup\\Scripts\\FirstLogon.ps1">');
  assert(pSpecFileIdx < pUserOnceFileIdx, 'Specialize.ps1 が UserOnce.ps1 より前にあること');
  assert(pUserOnceFileIdx < pDefUserFileIdx, 'UserOnce.ps1 が DefaultUser.ps1 より前にあること');
  assert(pDefUserFileIdx < pFirstLogonFileIdx, 'DefaultUser.ps1 が FirstLogon.ps1 より前にあること');

  console.log('\n====================================================');
  console.log(` テスト結果: ${passed} 項目合格 / ${failed} 項目失敗`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

try {
  runTests();
} catch (err) {
  console.error('Test run error:', err);
  process.exit(1);
}
