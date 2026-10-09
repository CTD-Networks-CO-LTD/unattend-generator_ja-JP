const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('================================================================');
console.log(' URI Too Long (414) Prevention & XML Double Hyphen Fix Test');
console.log('================================================================');

const enginePath = path.resolve(__dirname, '../docs/unattend_engine.js');
const engineCode = fs.readFileSync(enginePath, 'utf8');

let passedCount = 0;
let failedCount = 0;
function assert(condition, message) {
  if (condition) {
    console.log('[PASS] ' + message);
    passedCount++;
  } else {
    console.error('[FAIL] ' + message);
    failedCount++;
  }
}

class MockFormData {
  constructor() { this.data = new Map(); }
  append(k, v) { this.data.set(k, v); }
  get(k) { return this.data.get(k) || null; }
  entries() { return this.data.entries(); }
}

function createEngineContext(customWindow) {
  const mockWindow = Object.assign({
    addEventListener: () => {},
    location: { pathname: '/unattend-generator_ja-JP/', search: '', hash: '' },
    history: {
      lastUrl: null,
      replaceState: function (state, title, url) { this.lastUrl = url; }
    },
    sessionStorage: {
      storage: {},
      setItem: function (k, v) { this.storage[k] = String(v); },
      getItem: function (k) { return this.storage[k] || null; },
      removeItem: function (k) { delete this.storage[k]; },
      clear: function () { this.storage = {}; }
    }
  }, customWindow || {});

  const listeners = { click: [], submit: [] };
  const mockDoc = {
    readyState: 'complete',
    addEventListener: (type, fn) => { if (listeners[type]) listeners[type].push(fn); },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => ({ tagName: tag.toUpperCase(), setAttribute: () => {}, style: {} }),
    body: { appendChild: () => {}, removeChild: () => {} }
  };

  const sandbox = {
    window: mockWindow,
    document: mockDoc,
    Event: class { constructor(type) { this.type = type; } },
    URLSearchParams: URLSearchParams,
    FormData: MockFormData,
    Blob: class {},
    URL: { createObjectURL: () => '', revokeObjectURL: () => '' },
    FileReader: class {
      readAsText(file) {
        if (this.onload) this.onload({ target: { result: file.content || '' } });
      }
    },
    DOMParser: class {},
    console: console,
    setTimeout: (fn) => fn()
  };

  const ctx = vm.createContext(sandbox);
  vm.runInContext(engineCode, ctx);
  const engine = mockWindow.UnattendEngine || ctx.UnattendEngine;
  return { ctx, engine, sandbox, listeners, mockWindow };
}

function createDummyForm() {
  return {
    elements: [],
    querySelector: () => null,
    querySelectorAll: (sel) => {
      return [{
        name: 'Locale',
        value: '',
        dispatchEvent: () => {}
      }, {
        name: 'Keyboard',
        value: '',
        dispatchEvent: () => {}
      }];
    }
  };
}

// 1. XML コメント内二重ハイフン (--) エスケープ検証
console.log('\n--- 1. XML コメント内二重ハイフン (--) エスケープ検証 ---');
{
  const { engine } = createEngineContext();
  const formData = new MockFormData();
  formData.append('LanguageMode', 'Unattended');
  formData.append('Locale', 'ja-JP');
  formData.append('Keyboard', '00000411');
  const testScript = 'winget --version\r\nwinget install --id=Test.App -e --accept-source-agreements --accept-package-agreements\r\n---three-hyphens---and-trailing-';
  formData.append('FirstLogonScript0', testScript);
  formData.append('FirstLogonScriptType0', 'Ps1');

  const xml = engine.generateAutounattendXml(formData);
  const commentMatch = xml.match(/<!--([\s\S]*?)-->/);
  assert(commentMatch !== null, 'XML内にコメントが存在すること');

  if (commentMatch) {
    const commentBody = commentMatch[1];
    assert(!commentBody.includes('--'), 'XML コメント内に二重ハイフン (--) が一切含まれないこと');
    assert(!commentBody.endsWith('-'), 'XML コメント末尾がハイフン (-) で終了しないこと');
    assert(commentBody.includes('%2D%2Dversion'), 'コメント内で --version が %2D%2Dversion にエスケープされていること');
    assert(commentBody.includes('%2D%2Did'), 'コメント内で --id が %2D%2Did にエスケープされていること');

    const query = engine.extractQueryFromXml(xml);
    assert(query !== null, 'extractQueryFromXml でクエリが正常に抽出できること');
    const params = new URLSearchParams(query);
    const restoredScript = params.get('FirstLogonScript0');
    assert(restoredScript === testScript, 'URLSearchParams デコードにより元のスクリプト（-- を含む）が完全復元されること');
  }
}
// 2. original_autounattend.xml インポート & 再生成検証
console.log('\n--- 2. original_autounattend.xml インポート & 再生成検証 ---');
const origXmlPath = path.resolve(__dirname, '../../../original_autounattend.xml');
if (fs.existsSync(origXmlPath)) {
  const { engine } = createEngineContext();
  const origXml = fs.readFileSync(origXmlPath, 'utf8');
  const query = engine.extractQueryFromXml(origXml);
  assert(query !== null && query.length > 50000, 'original_autounattend.xml から巨大クエリ (56KB超) が抽出できること');

  const params = new URLSearchParams(query);
  const formData = new MockFormData();
  for (const [k, v] of params.entries()) {
    formData.append(k, v);
  }

  const regeneratedXml = engine.generateAutounattendXml(formData);
  const commentMatch = regeneratedXml.match(/<!--([\s\S]*?)-->/);
  assert(commentMatch !== null, '再生成されたXML内にコメントが存在すること');
  if (commentMatch) {
    const commentBody = commentMatch[1];
    assert(!commentBody.includes('--'), '再生成XMLコメント内に二重ハイフン (--) が含まれていないこと (Double hyphen 解消)');
    assert(!commentBody.endsWith('-'), '再生成XMLコメント末尾がハイフンで終わっていないこと');
  }
}

// 3. URI 長制御 & sessionStorage 保存検証 (HTTP 414 防止)
console.log('\n--- 3. URI 長制御 & sessionStorage 保存検証 (HTTP 414 防止) ---');
{
  const { engine, mockWindow } = createEngineContext();
  const shortXml = '<!--https://schneegans.de/windows/unattend-generator/?Locale=ja-JP&Keyboard=00000411-->\r\n<unattend/>';
  const dummyFile = { name: 'short.xml', content: shortXml };
  const dummyForm = createDummyForm();
  engine.importXmlFile(dummyFile, () => {}, dummyForm);

  assert(mockWindow.sessionStorage.getItem('unattend_generator_session_state') !== null,
    '短クエリ: sessionStorage に設定データが保存されること');
  assert(mockWindow.history.lastUrl && mockWindow.history.lastUrl.startsWith('?'),
    '短クエリ: URL履歴にクエリ (?Locale=ja-JP...) が反映されること');
}

{
  const { engine, mockWindow } = createEngineContext();
  const largeScript = 'echo ' + 'A'.repeat(5000);
  const largeParams = new URLSearchParams({
    LanguageMode: 'Unattended',
    Locale: 'ja-JP',
    FirstLogonScript0: largeScript
  });
  const largeXml = '<!--https://schneegans.de/windows/unattend-generator/?' + largeParams.toString() + '-->\r\n<unattend/>';
  const dummyFile = { name: 'large.xml', content: largeXml };
  const dummyForm = createDummyForm();
  engine.importXmlFile(dummyFile, () => {}, dummyForm);

  assert(mockWindow.sessionStorage.getItem('unattend_generator_session_state') !== null,
    '巨大クエリ: sessionStorage に全設定データが完全保存されること');
  assert(mockWindow.history.lastUrl && !mockWindow.history.lastUrl.includes('?'),
    '巨大クエリ: URLに巨大クエリが付与されず、パスのみとなり HTTP 414 が根本防止されること');
}

// 4. リロード時自動復元 (restoreFromUrlQuery)
console.log('\n--- 4. リロード時自動復元 (restoreFromUrlQuery) ---');
{
  const { engine, mockWindow } = createEngineContext({ location: { search: '?Locale=en-US' } });
  mockWindow.sessionStorage.setItem('unattend_generator_session_state', 'Locale=ja-JP');
  const dummyForm = createDummyForm();
  assert(engine.restoreFromUrlQuery(dummyForm) === true, 'URLクエリ優先復元が成功すること');
}

{
  const { engine, mockWindow } = createEngineContext({ location: { search: '' } });
  mockWindow.sessionStorage.setItem('unattend_generator_session_state', 'Locale=ja-JP&Keyboard=00000411');
  let updatedValue = '';
  const mockForm = {
    elements: [],
    querySelector: () => null,
    querySelectorAll: (sel) => sel.includes('select') ? [{
      name: 'Locale',
      set value(v) { updatedValue = v; },
      get value() { return updatedValue; },
      dispatchEvent: () => {}
    }] : []
  };
  assert(engine.restoreFromUrlQuery(mockForm) === true, 'URLクエリ空時に sessionStorage からの自動復元が成功すること');
  assert(updatedValue === 'ja-JP', 'sessionStorage の設定値がフォームに反映されること');
}

// 5. リセットボタン押下時のキャッシュクリア
console.log('\n--- 5. リセットボタン押下時のキャッシュクリア ---');
{
  const { mockWindow, listeners } = createEngineContext();
  mockWindow.sessionStorage.setItem('unattend_generator_session_state', 'Locale=ja-JP');

  const resetBtn = {
    tagName: 'BUTTON',
    textContent: 'Reset form to default values',
    getAttribute: () => './',
    closest: (sel) => sel.includes('button') ? resetBtn : null
  };
  const clickEvt = { type: 'click', target: resetBtn, defaultPrevented: false, stopPropagation: () => {}, preventDefault: () => {} };
  listeners.click.forEach(fn => fn(clickEvt));

  assert(mockWindow.sessionStorage.getItem('unattend_generator_session_state') === null,
    'Reset form to default values 押下時に sessionStorage キャッシュがクリアされること');
}

console.log('\n================================================================');
console.log(` テスト結果: ${passedCount} 項目合格 / ${failedCount} 項目失敗`);
console.log('================================================================');
if (failedCount > 0) process.exit(1);
