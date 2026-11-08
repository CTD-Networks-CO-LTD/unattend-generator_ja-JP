const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

function getArgValue(flag, defaultVal = '') {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return defaultVal;
}

function fetchUrl(url) {
  const sep = url.includes('?') ? '&' : '?';
  const cacheBustedUrl = `${url}${sep}_cb=${Date.now()}`;
  return new Promise((resolve, reject) => {
    https.get(
      cacheBustedUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
      }
    ).on('error', reject);
  });
}

function resolveGitMetadata() {
  const tagOutput = execSync('git tag -l "v*" --sort=-v:refname', { cwd: repoRoot, encoding: 'utf8' }).trim();
  const tags = tagOutput.split(/\r?\n/).map((t) => t.trim()).filter(Boolean);
  if (tags.length === 0) {
    throw new Error('リポジトリから v* リリースタグを取得できませんでした（フォールバック禁止）');
  }
  const latestTag = tags[0];
  const tagCommit = execSync(`git rev-list -n 1 "${latestTag}"`, { cwd: repoRoot, encoding: 'utf8' }).trim();
  const headCommit = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  return { latestTag, tagCommit, headCommit };
}

function loadEngineFromSource(codeStr) {
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: require,
    console: console,
    URLSearchParams: URLSearchParams,
    TextEncoder: TextEncoder,
    Uint8Array: Uint8Array,
    Blob: typeof Blob !== 'undefined' ? Blob : undefined,
    btoa: (str) => Buffer.from(str, 'binary').toString('base64')
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(codeStr, sandbox);
  return mod.exports && mod.exports.generateAutounattendXml ? mod.exports : sandbox.UnattendEngine;
}

function createFormData(obj) {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined && v !== null);
  return {
    get: (k) => (k in obj && obj[k] !== undefined && obj[k] !== null ? String(obj[k]) : null),
    has: (k) => k in obj && obj[k] !== undefined && obj[k] !== null,
    getAll: (k) => (k in obj && obj[k] !== undefined && obj[k] !== null ? [String(obj[k])] : []),
    entries: function* () {
      for (const [k, v] of entries) yield [k, String(v)];
    }
  };
}

function verifyPreviewEngineContract(engineCode, assert) {
  const eng = loadEngineFromSource(engineCode);
  assert('プレビュー unattend_engine.js から generateAutounattendXml がロード可能', !!(eng && typeof eng.generateAutounattendXml === 'function'));
  if (!eng || typeof eng.generateAutounattendXml !== 'function') return;

  const defOmittedXml = eng.generateAutounattendXml(createFormData({ PEMode: 'Default' }));
  assert(
    'プレビュー契約: PEMode=Default (未指定) で <UseConfigurationSet>false</UseConfigurationSet> が出力される',
    defOmittedXml.includes('<UseConfigurationSet>false</UseConfigurationSet>') &&
      !defOmittedXml.includes('<UseConfigurationSet>true</UseConfigurationSet>')
  );

  const defFalseXml = eng.generateAutounattendXml(createFormData({ PEMode: 'Default', UseConfigurationSet: 'false' }));
  assert(
    'プレビュー契約: PEMode=Default & UseConfigurationSet=false で <UseConfigurationSet>false</UseConfigurationSet> が出力される',
    defFalseXml.includes('<UseConfigurationSet>false</UseConfigurationSet>')
  );

  const defTrueXml = eng.generateAutounattendXml(createFormData({ PEMode: 'Default', UseConfigurationSet: 'true' }));
  assert(
    'プレビュー契約: PEMode=Default & UseConfigurationSet=true で <UseConfigurationSet>true</UseConfigurationSet> が出力される',
    defTrueXml.includes('<UseConfigurationSet>true</UseConfigurationSet>')
  );

  const genXml = eng.generateAutounattendXml(createFormData({ PEMode: 'Generated' }));
  assert(
    'プレビュー契約: PEMode=Generated で <UseConfigurationSet> 要素が出力されず %OEM_FOLDER% コピーが維持される',
    !genXml.includes('<UseConfigurationSet>') && genXml.includes('Copying contents of %OEM_FOLDER%')
  );

  const scriptXml = eng.generateAutounattendXml(
    createFormData({ PEMode: 'Script', PEScript: '@echo off\r\necho CustomPE\r\nwpeutil.exe reboot' })
  );
  assert(
    'プレビュー契約: PEMode=Script(非空) で <UseConfigurationSet> がなく独自スクリプトを保持し OEM コピーを注入しない',
    !scriptXml.includes('<UseConfigurationSet>') &&
      scriptXml.includes('CustomPE') &&
      !scriptXml.includes('Copying contents of %OEM_FOLDER%')
  );
}

function runStagedVerification(stagedDir, deployMode, expectedTag, expectedPreviewSha, tagCommit, assert) {
  console.log(`--- Staged Site Verification (${stagedDir}, mode=${deployMode}) ---`);
  const rootDir = path.resolve(process.cwd(), stagedDir);
  const prevDir = path.join(rootDir, 'preview');

  const prodIndex = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const prevIndex = fs.readFileSync(path.join(prevDir, 'index.html'), 'utf8');
  const prodHeader = fs.readFileSync(path.join(rootDir, 'sections', 'header.html'), 'utf8');
  const prevHeader = fs.readFileSync(path.join(prevDir, 'sections', 'header.html'), 'utf8');
  const prodEngine = fs.readFileSync(path.join(rootDir, 'unattend_engine.js'), 'utf8');
  const prevEngine = fs.readFileSync(path.join(prevDir, 'unattend_engine.js'), 'utf8');

  assert('ステージ済み本番: index.html に Cache-Control no-cache metaタグが存在', prodIndex.includes('no-cache, no-store, must-revalidate'));
  assert('ステージ済みプレビュー: index.html に Cache-Control no-cache metaタグが存在', prevIndex.includes('no-cache, no-store, must-revalidate'));
  assert(`ステージ済み本番: header.html の Releaseリンクが ${expectedTag} を指している`, prodHeader.includes('releases/tag/' + expectedTag));
  assert(`ステージ済みプレビュー: header.html の Releaseリンクが ${expectedTag} を指している`, prevHeader.includes('releases/tag/' + expectedTag));

  if (deployMode === 'release' || deployMode === 'both') {
    assert('リリースモード: 本番とプレビューの unattend_engine.js が一致', prodEngine === prevEngine);
  } else {
    assert(
      `プレビュー分離モード: 本番 unattend_engine.js が安定タグ ${expectedTag} のコミット (${tagCommit.substring(0, 7)}) を保持`,
      prodEngine.includes(`var COMMIT_HASH = '${tagCommit}';`)
    );
  }

  if (expectedPreviewSha) {
    assert(
      `ステージ済みプレビュー: unattend_engine.js が対象コミット (${expectedPreviewSha.substring(0, 7)}) を保持`,
      prevEngine.includes(`var COMMIT_HASH = '${expectedPreviewSha}';`)
    );
  }

  verifyPreviewEngineContract(prevEngine, assert);
}

async function runRemoteVerification(deployMode, expectedTag, expectedPreviewSha, tagCommit, skipRemoteContract, assert) {
  const prodBase = 'https://ctd-networks-co-ltd.github.io/unattend-generator_ja-JP';
  const prevBase = 'https://ctd-networks-co-ltd.github.io/unattend-generator_ja-JP/preview';

  const prodIndex = await fetchUrl(prodBase + '/');
  const prevIndex = await fetchUrl(prevBase + '/');

  assert('本番サイト index.html への疎通 (HTTP 200)', prodIndex.statusCode === 200, prodIndex.statusCode);
  assert('プレビューサイト index.html への疎通 (HTTP 200)', prevIndex.statusCode === 200, prevIndex.statusCode);
  assert('本番: index.html に Cache-Control no-cache metaタグが存在する', prodIndex.body.includes('no-cache, no-store, must-revalidate'));
  assert('本番: index.html に unattend_engine.js?v= キャッシュバスターが付与されている', /src="unattend_engine\.js\?v=[0-9a-fA-F]+"/.test(prodIndex.body));
  assert('プレビュー: index.html に unattend_engine.js?v= キャッシュバスターが付与されている', /src="unattend_engine\.js\?v=[0-9a-fA-F]+"/.test(prevIndex.body));

  const prodHeader = await fetchUrl(prodBase + '/sections/header.html');
  const prevHeader = await fetchUrl(prevBase + '/sections/header.html');
  assert('本番 sections/header.html 取得 (HTTP 200)', prodHeader.statusCode === 200, prodHeader.statusCode);
  assert('プレビュー sections/header.html 取得 (HTTP 200)', prevHeader.statusCode === 200, prevHeader.statusCode);

  assert(`本番: Releaseリンクが ${expectedTag} を指している`, prodHeader.body.includes('releases/tag/' + expectedTag));
  assert(`プレビュー: Releaseリンクが ${expectedTag} を指している`, prevHeader.body.includes('releases/tag/' + expectedTag));
  assert(`本番: Commitリンクが安定タグ ${expectedTag} のコミット (${tagCommit.substring(0, 7)}) を指している`, prodHeader.body.includes('commit/' + tagCommit));

  const prodEngine = await fetchUrl(prodBase + '/unattend_engine.js');
  const prevEngine = await fetchUrl(prevBase + '/unattend_engine.js');
  assert(`本番: unattend_engine.js に RELEASE_TAG = ${expectedTag} が定義されている`, prodEngine.body.includes(`var RELEASE_TAG = '${expectedTag}';`));
  assert(`本番: unattend_engine.js に安定タグコミット COMMIT_HASH = ${tagCommit.substring(0, 7)}... が定義されている`, prodEngine.body.includes(`var COMMIT_HASH = '${tagCommit}';`));
  assert(`プレビュー: unattend_engine.js に RELEASE_TAG = ${expectedTag} が定義されている`, prevEngine.body.includes(`var RELEASE_TAG = '${expectedTag}';`));
  assert('プレビュー: unattend_engine.js に COMMIT_HASH が定義されている', /var COMMIT_HASH = '[0-9a-fA-F]{40}';/.test(prevEngine.body));

  if (deployMode === 'release' || deployMode === 'both') {
    assert('リリースモード: 本番とプレビューの header.html が完全一致', prodHeader.body.trim() === prevHeader.body.trim());
    assert('リリースモード: 本番とプレビューの unattend_engine.js が完全一致', prodEngine.body.trim() === prevEngine.body.trim());
  }

  if (expectedPreviewSha) {
    assert(
      `プレビュー: unattend_engine.js が期待SHA (${expectedPreviewSha.substring(0, 7)}) と一致`,
      prevEngine.body.includes(`var COMMIT_HASH = '${expectedPreviewSha}';`)
    );
  }

  if (!skipRemoteContract) {
    verifyPreviewEngineContract(prevEngine.body, assert);
  }
}

async function run() {
  console.log('====================================================');
  console.log('  本番サイト (/) & プレビューサイト (/preview/) 検証');
  console.log('====================================================\n');

  const meta = resolveGitMetadata();
  const stagedDir = getArgValue('--staged-dir', '');
  const deployMode = getArgValue('--deploy-mode', 'preview');
  const expectedTag = getArgValue('--expected-tag', meta.latestTag);
  const expectedPreviewSha = getArgValue('--expected-preview-sha', '');
  const skipRemoteContract = process.argv.includes('--skip-remote-contract');

  let passCount = 0;
  let failCount = 0;

  function assert(name, condition, details) {
    if (condition) {
      console.log(' [PASS] ' + name);
      passCount++;
    } else {
      console.error(' [FAIL] ' + name + (details ? ' (' + details + ')' : ''));
      failCount++;
    }
  }

  if (stagedDir) {
    runStagedVerification(stagedDir, deployMode, expectedTag, expectedPreviewSha, meta.tagCommit, assert);
  } else {
    await runRemoteVerification(deployMode, expectedTag, expectedPreviewSha, meta.tagCommit, skipRemoteContract, assert);
  }

  console.log('\n====================================================');
  console.log(` テスト結果: ${passCount} 項目合格 / ${failCount} 項目失敗`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
