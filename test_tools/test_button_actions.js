/**
 * ボタンアクション（View / Download / ISO）および ISO ラッパー生成検証テスト
 * 対象: docs/unattend_engine.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('====================================================');
console.log(' Button Actions & ISO Wrapper Parity Test');
console.log('====================================================');

const enginePath = path.resolve(__dirname, '../docs/unattend_engine.js');
const engineCode = fs.readFileSync(enginePath, 'utf8');

function createMockEnvironment() {
  const listeners = { click: [], submit: [] };
  let openedUrl = null;
  const downloads = [];

  class MockBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.type = options && options.type ? options.type : '';
    }
    toBuffer() {
      const bufs = [];
      for (const p of this.parts) {
        if (typeof p === 'string') {
          bufs.push(Buffer.from(p, 'utf8'));
        } else if (p instanceof Uint8Array || Buffer.isBuffer(p)) {
          bufs.push(Buffer.from(p));
        }
      }
      return Buffer.concat(bufs);
    }
  }

  class MockURL {
    static createObjectURL(blob) {
      return { _isMockUrl: true, blob: blob };
    }
    static revokeObjectURL() {}
  }

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
      this.clicked = false;
      this.form = null;
      this.style = {};
      this.href = null;
      this.download = null;
      this.children = [];
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k] || null; }
    closest(sel) {
      if (sel.includes('button') && (this.tagName === 'BUTTON' || this.type === 'submit')) return this;
      return null;
    }
    appendChild(child) {
      this.children.push(child);
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) this.children.splice(idx, 1);
    }
    click() {
      this.clicked = true;
      if (this.download !== null && this.href) {
        downloads.push({
          download: this.download,
          blob: this.href.blob || null
        });
      }
    }
  }

  class MockFormData {
    constructor(form) {
      this.data = new Map();
      if (form && form.elements) {
        for (const el of form.elements) {
          if (el.name) {
            if (el.type === 'checkbox') {
              if (el.checked) {
                this.data.set(el.name, el.value || 'true');
              }
            } else if (el.type === 'radio') {
              if (el.checked) {
                this.data.set(el.name, el.value);
              }
            } else {
              this.data.set(el.name, el.value);
            }
          }
        }
      }
    }
    get(k) { return this.data.has(k) ? this.data.get(k) : null; }
    set(k, v) { this.data.set(k, v); }
  }

  class MockForm extends MockElement {
    constructor() {
      super('FORM', '', '', '');
      this.elements = [];
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
  }

  const mainForm = new MockForm();
  mainForm.id = 'mainForm';

  const mockDoc = {
    readyState: 'complete',
    body: new MockElement('BODY', 'body', '', ''),
    getElementById: (id) => (id === 'mainForm' ? mainForm : null),
    querySelector: (sel) => (sel === 'form' ? mainForm : null),
    querySelectorAll: () => [],
    createElement: (tag) => new MockElement(tag),
    addEventListener: (type, fn) => {
      if (listeners[type]) listeners[type].push(fn);
    }
  };

  const mockWindow = {
    document: mockDoc,
    URL: MockURL,
    Blob: MockBlob,
    TextEncoder: TextEncoder,
    Uint8Array: Uint8Array,
    FormData: MockFormData,
    open: (url, target) => { openedUrl = { url, target }; },
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => {},
    addEventListener: () => {}
  };

  const sandbox = {
    window: mockWindow,
    document: mockDoc,
    URL: MockURL,
    Blob: MockBlob,
    TextEncoder: TextEncoder,
    Uint8Array: Uint8Array,
    FormData: MockFormData,
    global: mockWindow,
    console: console,
    setTimeout: (fn) => setTimeout(fn, 0),
    clearTimeout: () => {}
  };

  vm.createContext(sandbox);
  vm.runInContext(engineCode, sandbox);

  return {
    window: mockWindow,
    document: mockDoc,
    sandbox: sandbox,
    mainForm: mainForm,
    listeners: listeners,
    getOpenedUrl: () => openedUrl,
    getDownloads: () => downloads,
    resetRecordings: () => {
      openedUrl = null;
      downloads.length = 0;
    },
    triggerClick: (btn) => {
      const evt = new MockEvent('click', btn);
      for (const listener of listeners.click) {
        listener(evt);
        if (evt.propagationStopped) break;
      }
      return evt;
    }
  };
}
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(` [PASS] ${message}`);
    passed++;
  } else {
    console.error(` [FAIL] ${message}`);
    failed++;
  }
}

// ----------------------------------------------------
// Test 1: Action Detection Logic (Button Click & Routing)
// ----------------------------------------------------
console.log('\n--- Test 1: Action Detection & Priority Verification ---');
const env = createMockEnvironment();

// Case 1A: View button
const viewBtn = env.document.createElement('BUTTON');
viewBtn.textContent = 'View .xml file';
viewBtn.setAttribute('formaction', './view/');
viewBtn.form = env.mainForm;

env.resetRecordings();
const evtView = env.triggerClick(viewBtn);
assert(evtView.defaultPrevented, 'View button prevents default submit');
const viewOpened = env.getOpenedUrl();
assert(viewOpened !== null && viewOpened.target === '_blank', 'View button opens XML in new window');
assert(viewOpened && viewOpened.url.blob && viewOpened.url.blob.type.includes('text/xml'), 'View button creates text/xml Blob');

// Case 1B: Download XML button (Default filename)
const dlBtn = env.document.createElement('BUTTON');
dlBtn.textContent = 'Download .xml file';
dlBtn.setAttribute('formaction', './download/');
dlBtn.form = env.mainForm;

env.resetRecordings();
const evtDl = env.triggerClick(dlBtn);
assert(evtDl.defaultPrevented, 'Download button prevents default submit');
let dls = env.getDownloads();
assert(dls.length === 1, 'Download button triggered exactly 1 file download');
assert(dls[0].download === 'autounattend.xml', 'Default XML download filename is "autounattend.xml"');
assert(dls[0].blob && dls[0].blob.type.includes('application/xml'), 'Download XML blob MIME type is application/xml');

// Case 1C: Download XML button (NotFilename = true)
const notFileCheckbox = env.document.createElement('INPUT');
notFileCheckbox.name = 'NotFilename';
notFileCheckbox.type = 'checkbox';
notFileCheckbox.value = 'true';
notFileCheckbox.checked = true;
env.mainForm.elements.push(notFileCheckbox);

env.resetRecordings();
env.triggerClick(dlBtn);
dls = env.getDownloads();
assert(dls.length === 1 && dls[0].download === 'notautounattend.xml', 'When NotFilename=true, XML download filename is "notautounattend.xml"');

// Reset NotFilename checkbox
notFileCheckbox.checked = false;

// ----------------------------------------------------
// Test 2: ISO Button Click (English and Japanese)
// ----------------------------------------------------
console.log('\n--- Test 2: ISO Button Action Priority & Filename Verification ---');

// Case 2A: English ISO button with formaction="./iso/"
const isoBtnEn = env.document.createElement('BUTTON');
isoBtnEn.textContent = 'Download .xml wrapped in .iso file';
isoBtnEn.setAttribute('formaction', './iso/');
isoBtnEn.form = env.mainForm;

env.resetRecordings();
const evtIsoEn = env.triggerClick(isoBtnEn);
assert(evtIsoEn.defaultPrevented, 'ISO button prevents default submit');
dls = env.getDownloads();
assert(dls.length === 1, 'ISO button triggered exactly 1 download');
assert(dls[0].download === 'unattend.iso', 'ISO download filename is strictly "unattend.iso" (not autounattend.iso or autounattend.xml)');
assert(dls[0].blob && dls[0].blob.type === 'application/x-iso9660-image', 'ISO blob MIME type is application/x-iso9660-image');

// Case 2B: Japanese translated ISO button (contains both 'ダウンロード' and '.iso')
const isoBtnJa = env.document.createElement('BUTTON');
isoBtnJa.textContent = '.isoファイルにラップされた.xmlファイルをダウンロードしてください。';
isoBtnJa.setAttribute('formaction', './iso/');
isoBtnJa.form = env.mainForm;

env.resetRecordings();
const evtIsoJa = env.triggerClick(isoBtnJa);
assert(evtIsoJa.defaultPrevented, 'Japanese ISO button prevents default submit');
dls = env.getDownloads();
assert(dls.length === 1, 'Japanese ISO button correctly triggers "unattend.iso" download despite containing "ダウンロード"');

// Case 2C: ISO button with legacy formaction "/windows/unattend-generator/iso/"
const isoBtnLegacy = env.document.createElement('BUTTON');
isoBtnLegacy.textContent = 'Download .xml wrapped in .iso file';
isoBtnLegacy.setAttribute('formaction', '/windows/unattend-generator/iso/');
isoBtnLegacy.form = env.mainForm;

env.resetRecordings();
env.triggerClick(isoBtnLegacy);
dls = env.getDownloads();
assert(dls.length === 1, 'ISO button with legacy formaction also resolves to "unattend.iso"');

// ----------------------------------------------------
// Test 3: ISO Image Internal File Structure Verification
// ----------------------------------------------------
console.log('\n--- Test 3: ISO 9660 Image Internal Structure & NotFilename Parity ---');

// Default ISO content (autounattend.xml inside)
notFileCheckbox.checked = false;
env.resetRecordings();
env.triggerClick(isoBtnEn);
dls = env.getDownloads();
const isoBufferDefault = dls[0].blob.toBuffer();

assert(isoBufferDefault.length >= 2048 * 20, 'ISO size is at least 20 sectors (>= 40KB)');
const pvdMagic = isoBufferDefault.slice(16 * 2048 + 1, 16 * 2048 + 6).toString('ascii');
assert(pvdMagic === 'CD001', 'Sector 16 contains ISO 9660 Primary Volume Descriptor signature "CD001"');

const volumeLabel = isoBufferDefault.slice(16 * 2048 + 40, 16 * 2048 + 72).toString('ascii');
assert(volumeLabel.trim() === 'UNATTEND', `Primary Volume Descriptor volume identifier is "UNATTEND" (actual: "${volumeLabel.trim()}")`);

// Check file entry inside root directory table (Sector 18)
// Root directory has '.' (ptr=0, len=34), '..' (ptr=34, len=34), and file entry at ptr=68
const dirSectorDefault = isoBufferDefault.slice(18 * 2048, 19 * 2048);
const nameLenDefault = dirSectorDefault[68 + 32];
const fileNameDefault = dirSectorDefault.slice(68 + 33, 68 + 33 + nameLenDefault).toString('ascii');
assert(fileNameDefault === 'AUTOUNATTEND.XML;1', `ISO directory table file entry is "AUTOUNATTEND.XML;1" by default (actual: "${fileNameDefault}")`);

// NotFilename = true ISO content (notautounattend.xml inside)
notFileCheckbox.checked = true;
env.resetRecordings();
env.triggerClick(isoBtnEn);
dls = env.getDownloads();
const isoBufferNotFilename = dls[0].blob.toBuffer();
const dirSectorNotFilename = isoBufferNotFilename.slice(18 * 2048, 19 * 2048);
const nameLenNotFilename = dirSectorNotFilename[68 + 32];
const fileNameNotFilename = dirSectorNotFilename.slice(68 + 33, 68 + 33 + nameLenNotFilename).toString('ascii');
assert(fileNameNotFilename === 'NOTAUTOUNATTEND.XML;1', `ISO directory table file entry is "NOTAUTOUNATTEND.XML;1" when NotFilename=true (actual: "${fileNameNotFilename}")`);

console.log('\n====================================================');
console.log(` Results: ${passed} PASSED / ${failed} FAILED`);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
