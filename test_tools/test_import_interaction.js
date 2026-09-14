/**
 * XMLインポートボタン連動・二重ダイアログ抑止検証テスト
 * 対象: docs/unattend_engine.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('====================================================');
console.log(' XML Import Interaction & Modal Suppression Test');
console.log('====================================================');

const enginePath = path.resolve(__dirname, '../docs/unattend_engine.js');
const engineCode = fs.readFileSync(enginePath, 'utf8');

const sampleXml = `<!--https://schneegans.de/windows/unattend-generator/?LanguageMode=Unattended&Locale=ja-JP&Keyboard=00000411&ComputerName=TEST-PC-->
<unattend xmlns="urn:schemas-microsoft-com:unattend">
</unattend>`;

function createMockEnvironment() {
  const listeners = { click: [], submit: [] };
  const alertMessages = [];
  const dynamicInputs = [];

  class MockEvent {
    constructor(type, target) {
      this.type = type;
      this.target = target;
      this.defaultPrevented = false;
      this.propagationStopped = false;
    }
    preventDefault() { this.defaultPrevented = true; }
    stopPropagation() { this.propagationStopped = true; }
  }

  class MockElement {
    constructor(tagName, id, textContent, type) {
      this.tagName = tagName.toUpperCase();
      this.id = id || '';
      this.textContent = textContent || '';
      this.type = type || '';
      this.value = '';
      this.attributes = {};
      this.files = [];
      this.clicked = false;
      this.form = null;
      this.style = {};
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k] || null; }
    closest(sel) {
      if (sel.includes('button') && (this.tagName === 'BUTTON' || this.type === 'submit')) return this;
      return null;
    }
    addEventListener() {}
    dispatchEvent() {}
    click() { this.clicked = true; }
  }

  class MockForm extends MockElement {
    constructor() {
      super('FORM', '', '', '');
      this.elements = [];
    }
    querySelector(sel) {
      if (sel === '#Upload') return this.elements.find(el => el.id === 'Upload') || null;
      if (sel === 'input[type="file"]') return this.elements.find(el => el.tagName === 'INPUT' && el.type === 'file') || null;
      if (sel.includes('name="Locale"')) return this.elements.find(el => el.name === 'Locale') || null;
      if (sel.includes('name="Keyboard"')) return this.elements.find(el => el.name === 'Keyboard') || null;
      if (sel.includes('name="ComputerName"')) return this.elements.find(el => el.name === 'ComputerName') || null;
      return null;
    }
    querySelectorAll(sel) {
      if (sel.startsWith('select')) return this.elements.filter(el => el.tagName === 'SELECT');
      if (sel.startsWith('input[type="checkbox"]')) return this.elements.filter(el => el.type === 'checkbox');
      if (sel.startsWith('input[type="radio"]')) return this.elements.filter(el => el.type === 'radio');
      if (sel.includes('AccountName')) return this.elements.filter(el => el.name && el.name.startsWith('AccountName'));
      if (sel.includes('input:not')) return this.elements.filter(el => el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file'].includes(el.type));
      return this.elements.filter(el => el.tagName === 'INPUT');
    }
  }

  const domElements = new Map();
  const formPresets = new MockForm();
  const uploadInput = new MockElement('INPUT', 'Upload', '', 'file');
  uploadInput.form = formPresets;
  formPresets.elements.push(uploadInput);
  domElements.set('Upload', uploadInput);

  const mainForm = new MockForm();
  mainForm.id = 'mainForm';
  const mainTable = new MockElement('TABLE', 'main-table', '', '');
  mainTable.form = mainForm;
  mainTable.closest = (sel) => sel === 'form' ? mainForm : null;
  domElements.set('main-table', mainTable);

  const localeSelect = new MockElement('SELECT', 'Locale', '', '');
  localeSelect.name = 'Locale';
  const keyboardSelect = new MockElement('SELECT', 'Keyboard', '', '');
  keyboardSelect.name = 'Keyboard';
  const compInput = new MockElement('INPUT', 'ComputerName', '', 'text');
  compInput.name = 'ComputerName';

  mainForm.elements.push(localeSelect, keyboardSelect, compInput);
  localeSelect.form = mainForm;
  keyboardSelect.form = mainForm;
  compInput.form = mainForm;

  domElements.set('Locale', localeSelect);
  domElements.set('Keyboard', keyboardSelect);
  domElements.set('ComputerName', compInput);

  class MockFileReader {
    readAsText(file) {
      if (this.onload) this.onload({ target: { result: file.content || '' } });
    }
  }

  const mockDoc = {
    readyState: 'complete',
    addEventListener: (type, fn) => { if (listeners[type]) listeners[type].push(fn); },
    getElementById: (id) => domElements.get(id) || null,
    querySelector: (sel) => {
      if (sel.includes('select[name="Locale"]')) return localeSelect;
      if (sel.includes('#main-table')) return mainTable;
      return null;
    },
    querySelectorAll: (sel) => sel === 'form' ? [formPresets, mainForm] : [],
    createElement: (tag) => {
      const el = new MockElement(tag);
      if (tag === 'input') dynamicInputs.push(el);
      return el;
    },
    body: {
      appendChild: (el) => { if (el.id) domElements.set(el.id, el); },
      removeChild: (el) => { if (el.id) domElements.delete(el.id); }
    }
  };

  const mockWindow = {
    addEventListener: () => {},
    location: { search: '' },
    history: { replaceState: () => {} }
  };

  const mockAlert = (msg) => { alertMessages.push(msg); };

  const sandbox = {
    window: mockWindow,
    document: mockDoc,
    alert: mockAlert,
    Event: class MockNativeEvent {
      constructor(type) { this.type = type; }
    },
    URLSearchParams: URLSearchParams,
    FormData: class {},
    Blob: class {},
    URL: { createObjectURL: () => '', revokeObjectURL: () => '' },
    FileReader: MockFileReader,
    DOMParser: class {
      parseFromString() { return { querySelector: () => null, querySelectorAll: () => [] }; }
    },
    console: console,
    setTimeout: (fn) => { fn(); }
  };

  const ctx = vm.createContext(sandbox);
  vm.runInContext(engineCode, ctx);

  return {
    listeners, alertMessages, dynamicInputs, domElements, formPresets, mainForm,
    uploadInput, localeSelect, keyboardSelect, compInput, MockEvent, MockElement
  };
}

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

// テスト Case 1: ファイル選択済みで "Import file" (英語ボタン) クリック
{
  const env = createMockEnvironment();
  const dummyFile = { name: 'autounattend.xml', content: sampleXml };
  env.uploadInput.files = [dummyFile];

  const btn = new env.MockElement('BUTTON', '', 'Import file');
  btn.setAttribute('formaction', './');
  btn.form = env.formPresets;

  const evt = new env.MockEvent('click', btn);
  env.listeners.click.forEach(fn => fn(evt));

  assert(evt.defaultPrevented, 'Case 1: e.preventDefault() 実行');
  assert(evt.propagationStopped, 'Case 1: e.stopPropagation() 実行');
  assert(env.dynamicInputs.length === 0, 'Case 1: 二重ダイアログ用 input が生成されない (不都合解消)');
  assert(env.alertMessages.length === 1 && env.alertMessages[0].includes('正常にインポートしました'), 'Case 1: インポート成功の完了通知アラートが表示された');
  assert(env.localeSelect.value === 'ja-JP', 'Case 1: XML 設定値 (Locale=ja-JP) が即座に反映された');
  assert(env.keyboardSelect.value === '00000411', 'Case 1: XML 設定値 (Keyboard=00000411) が即座に反映された');
  assert(env.compInput.value === 'TEST-PC', 'Case 1: XML 設定値 (ComputerName=TEST-PC) が即座に反映された');
}

// テスト Case 2: ファイル選択済みで "ファイルのインポート" (日本語ボタン) クリック
{
  const env = createMockEnvironment();
  const dummyFile = { name: 'autounattend_ja.xml', content: sampleXml };
  env.uploadInput.files = [dummyFile];

  const btn = new env.MockElement('BUTTON', '', 'ファイルのインポート');
  btn.setAttribute('formaction', './');
  btn.form = env.formPresets;

  const evt = new env.MockEvent('click', btn);
  env.listeners.click.forEach(fn => fn(evt));

  assert(evt.defaultPrevented && evt.propagationStopped, 'Case 2: イベント伝播およびデフォルト動作の中断');
  assert(env.dynamicInputs.length === 0, 'Case 2: 日本語ボタンでも二重ダイアログ用 input は生成されない');
  assert(env.alertMessages.length === 1 && env.alertMessages[0].includes('正常にインポートしました'), 'Case 2: 日本語ボタンでもインポート成功の完了通知アラートが表示された');
  assert(env.localeSelect.value === 'ja-JP', 'Case 2: 日本語ボタンで XML 設定値が正常に反映された');
}

// テスト Case 3: ファイル未選択状態でボタンをクリック
{
  const env = createMockEnvironment();
  env.uploadInput.files = [];

  const btn = new env.MockElement('BUTTON', '', 'Import file');
  btn.setAttribute('formaction', './');
  btn.form = env.formPresets;

  const evt = new env.MockEvent('click', btn);
  env.listeners.click.forEach(fn => fn(evt));

  assert(evt.defaultPrevented && evt.propagationStopped, 'Case 3: イベントキャンセル');
  assert(env.dynamicInputs.length === 0, 'Case 3: 未選択時にも強制ダイアログは開かない');
  assert(env.alertMessages.length === 1, 'Case 3: アラートが1件表示された');
  assert(env.alertMessages[0].includes('インポートするXMLファイルを選択してください'), 'Case 3: 正しいガイダンス文言が表示された');
}

// テスト Case 4: フォーム直接 submit 時の静的ホスティング保護 (HTTP 405防止)
{
  const env = createMockEnvironment();
  const dummyFile = { name: 'submitted.xml', content: sampleXml };
  env.uploadInput.files = [dummyFile];

  const submitEvt = new env.MockEvent('submit', env.formPresets);
  env.listeners.submit.forEach(fn => fn(submitEvt));

  assert(submitEvt.defaultPrevented, 'Case 4: submit の preventDefault() (405防止)');
  assert(submitEvt.propagationStopped, 'Case 4: submit の stopPropagation()');
  assert(env.localeSelect.value === 'ja-JP', 'Case 4: submit イベントから直接 XML 設定がインポートされた');
}

// テスト Case 5: #Upload が存在しない特殊環境におけるフォールバック動作
{
  const env = createMockEnvironment();
  env.domElements.delete('Upload');
  env.formPresets.elements = [];

  const btn = new env.MockElement('BUTTON', '', 'XML設定の読込');
  btn.setAttribute('formaction', './');
  btn.form = env.formPresets;

  const evt = new env.MockEvent('click', btn);
  env.listeners.click.forEach(fn => fn(evt));

  assert(env.dynamicInputs.length === 1, 'Case 5: フォールバック時のみ動的 input 要素が生成');
  assert(env.dynamicInputs[0].clicked === true, 'Case 5: 動的 input の .click() が発火');
}

console.log('====================================================');
console.log(` Results: ${passedCount} PASSED / ${failedCount} FAILED`);
console.log('====================================================');

if (failedCount > 0) process.exit(1);
