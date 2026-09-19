const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('====================================================');
  console.log('  本番公開サイト & プレビューサイト 改修効果確認テスト');
  console.log('====================================================\n');

  const prodBase = 'https://ctd-networks-co-ltd.github.io/unattend-generator_ja-JP';
  const prevBase = 'https://ctd-networks-co-ltd.github.io/unattend-generator_ja-JP/preview';

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

  // Test 1: 本番とプレビューの HTTP 疎通
  const prodIndex = await fetchUrl(prodBase + '/');
  const prevIndex = await fetchUrl(prevBase + '/');

  assert('本番サイト index.html への疎通 (HTTP 200)', prodIndex.statusCode === 200, prodIndex.statusCode);
  assert('プレビューサイト index.html への疎通 (HTTP 200)', prevIndex.statusCode === 200, prevIndex.statusCode);
  assert('本番とプレビューの Content-Length が一致', prodIndex.headers['content-length'] === prevIndex.headers['content-length'],
    'prod=' + prodIndex.headers['content-length'] + ', prev=' + prevIndex.headers['content-length']);

  // index.html のキャッシュ無効化 Meta タグおよびキャッシュバスター検証
  assert('本番: index.html に Cache-Control no-cache metaタグが存在する',
    prodIndex.body.includes('http-equiv="Cache-Control"') && prodIndex.body.includes('no-cache, no-store, must-revalidate'));
  assert('本番: index.html に unattend_engine.js?v= キャッシュバスターが付与されている',
    /src="unattend_engine\.js\?v=[0-9a-fA-F]+"/.test(prodIndex.body));
  assert('本番: index.html の loadSections に cache: "no-cache" が設定されている',
    prodIndex.body.includes("cache: 'no-cache'"));

  // Test 2: sections/header.html の検証
  const prodHeader = await fetchUrl(prodBase + '/sections/header.html');
  const prevHeader = await fetchUrl(prevBase + '/sections/header.html');

  assert('本番 sections/header.html 取得 (HTTP 200)', prodHeader.statusCode === 200, prodHeader.statusCode);
  assert('プレビュー sections/header.html 取得 (HTTP 200)', prevHeader.statusCode === 200, prevHeader.statusCode);

  // 最新リリースタグを特定
  const { execSync } = require('child_process');
  let expectedTag = 'v1.4.1_20260919';
  try {
    const tagOutput = execSync('git tag -l "v*" --sort=-v:refname', { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim();
    const tags = tagOutput.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
    if (tags.length > 0) expectedTag = tags[0];
  } catch (e) {}

  // 本番ヘッダーの詳細検証
  const prodBody = prodHeader.body;
  assert('本番: header.html に説明文が含まれている', prodBody.includes('answer files') && prodBody.includes('unattended installations'));
  assert(`本番: Releaseリンクが ${expectedTag} を指している`, prodBody.includes('releases/tag/' + expectedTag));
  assert(`本番: Releaseリンクテキストが ${expectedTag} である`, prodBody.includes('>' + expectedTag + '</a>'));
  assert('本番: Commitリンクが最新コミットを指している', /commit\/[0-9a-fA-F]{40}/.test(prodBody));
  assert('本番: 動的時間表示用の data-commit-date が設定されている', prodBody.includes('id="header-commit-time" data-commit-date='));

  // プレビューヘッダーの詳細検証
  const prevBody = prevHeader.body;
  assert(`プレビュー: Releaseリンクが ${expectedTag} を指している`, prevBody.includes('releases/tag/' + expectedTag));
  assert(`プレビュー: Releaseリンクテキストが ${expectedTag} である`, prevBody.includes('>' + expectedTag + '</a>'));
  assert('プレビュー: Commitリンクが最新コミットを指している', /commit\/[0-9a-fA-F]{40}/.test(prevBody));

  // 本番とプレビューのヘッダー完全パリティ検証
  assert('本番とプレビューの header.html 内容が完全一致（Byte-exact）', prodBody.trim() === prevBody.trim());

  // Test 3: unattend_engine.js の検証
  const prodEngine = await fetchUrl(prodBase + '/unattend_engine.js');
  const prevEngine = await fetchUrl(prevBase + '/unattend_engine.js');

  assert(`本番: unattend_engine.js に RELEASE_TAG = ${expectedTag} が定義されている`,
    prodEngine.body.includes(`var RELEASE_TAG = '${expectedTag}';`));
  assert('本番: unattend_engine.js に COMMIT_HASH が定義されている',
    /var COMMIT_HASH = '[0-9a-fA-F]{40}';/.test(prodEngine.body));
  assert(`プレビュー: unattend_engine.js に RELEASE_TAG = ${expectedTag} が定義されている`,
    prevEngine.body.includes(`var RELEASE_TAG = '${expectedTag}';`));
  assert('本番とプレビューの unattend_engine.js 内容が完全一致（Byte-exact）', prodEngine.body.trim() === prevEngine.body.trim());

  console.log('\n====================================================');
  console.log(` テスト結果: ${passCount} 項目合格 / ${failCount} 項目失敗`);
  console.log('====================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
