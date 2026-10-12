/**
 * Upstream UI Parity & AddMore Dynamic Expansion Integrated Test
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs');
const sectionsDir = path.join(docsDir, 'sections');

let passes = 0;
let fails = 0;
function assert(name, cond, details = '') {
  if (cond) {
    console.log(' [PASS] ' + name);
    passes++;
  } else {
    console.error(' [FAIL] ' + name + (details ? ' (' + details + ')' : ''));
    fails++;
  }
}

console.log('====================================================');
console.log('  Upstream UI Parity & AddMore Integrated Test');
console.log('====================================================\n');

class SimpleNode {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName.toUpperCase();
    this.parentElement = null;
    this.childNodes = [];
  }
  get parentNode() { return this.parentElement; }
  get previousSibling() {
    if (!this.parentElement) return null;
    const idx = this.parentElement.childNodes.indexOf(this);
    return idx > 0 ? this.parentElement.childNodes[idx - 1] : null;
  }
  get nextSibling() {
    if (!this.parentElement) return null;
    const idx = this.parentElement.childNodes.indexOf(this);
    return idx !== -1 && idx < this.parentElement.childNodes.length - 1 ? this.parentElement.childNodes[idx + 1] : null;
  }
  get previousElementSibling() {
    let s = this.previousSibling;
    while (s) {
      if (s.nodeType === 1) return s;
      s = s.previousSibling;
    }
    return null;
  }
  get nextElementSibling() {
    let s = this.nextSibling;
    while (s) {
      if (s.nodeType === 1) return s;
      s = s.nextSibling;
    }
    return null;
  }
  compareDocumentPosition(other) {
    const all = [];
    function collect(n) {
      all.push(n);
      for (const c of n.childNodes) collect(c);
    }
    let root = this;
    while (root.parentElement) root = root.parentElement;
    collect(root);
    return all.indexOf(other) < all.indexOf(this) ? 2 : 4;
  }
}

class SimpleElement extends SimpleNode {
  constructor(tagName) {
    super(1, tagName);
    this.tagName = this.nodeName;
    this.attributes = new Map();
    this.value = '';
    this.disabled = false;
    this._classList = new Set();
  }
  getAttribute(name) { return this.attributes.get(name.toLowerCase()) || null; }
  setAttribute(name, val) {
    this.attributes.set(name.toLowerCase(), String(val));
    if (name.toLowerCase() === 'class') {
      this._classList = new Set(String(val).split(/\s+/).filter(Boolean));
    }
  }
  get classList() {
    return {
      contains: (c) => this._classList.has(c),
      add: (c) => {
        this._classList.add(c);
        this.attributes.set('class', Array.from(this._classList).join(' '));
      },
      remove: (c) => {
        this._classList.delete(c);
        this.attributes.set('class', Array.from(this._classList).join(' '));
      }
    };
  }
  matches(selector) {
    const parts = selector.split(',').map(s => s.trim());
    return parts.some(sel => {
      if (sel === 'table, ol') return this.tagName === 'TABLE' || this.tagName === 'OL';
      if (sel === '.Hidden') return this.classList.contains('Hidden');
      if (sel === 'tr.Hidden') return this.tagName === 'TR' && this.classList.contains('Hidden');
      if (sel === 'li.Hidden') return this.tagName === 'LI' && this.classList.contains('Hidden');
      if (sel === 'input.AddMore') return this.tagName === 'INPUT' && this.classList.contains('AddMore');
      if (sel === 'input, select, textarea') return ['INPUT', 'SELECT', 'TEXTAREA'].includes(this.tagName);
      const attrMatch = sel.match(/^(?:([a-zA-Z0-9]+))?\[([a-zA-Z0-9_\-]+)([\^$*]?=)?(?:["']?([^"']*)["']?)?\]$/);
      if (attrMatch) {
        const tag = attrMatch[1];
        const attrName = attrMatch[2];
        const op = attrMatch[3];
        const val = attrMatch[4];
        if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
        const attrVal = this.getAttribute(attrName);
        if (attrVal === null) return false;
        if (!op) return true;
        if (op === '=') return attrVal === val;
        if (op === '^=') return attrVal.startsWith(val);
        if (op === '$=') return attrVal.endsWith(val);
        if (op === '*=') return attrVal.includes(val);
      }
      return this.tagName.toLowerCase() === sel.toLowerCase();
    });
  }
  closest(selector) {
    let curr = this;
    while (curr && curr.nodeType === 1) {
      if (curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const res = [];
    function search(node) {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (child.matches(selector)) res.push(child);
          search(child);
        }
      }
    }
    search(this);
    return res;
  }
  appendChild(child) {
    child.parentElement = this;
    this.childNodes.push(child);
    return child;
  }
}

function parseHtmlFragment(html) {
  const root = new SimpleElement('ROOT');
  let current = root;
  const tagRegex = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let m;
  const voidTags = new Set(['INPUT', 'IMG', 'BR', 'HR', 'META', 'LINK']);

  while ((m = tagRegex.exec(html)) !== null) {
    if (m[3]) continue;
    const tagName = m[1].toUpperCase();
    const isClosing = m[0].startsWith('</');
    const isSelfClosing = m[0].endsWith('/>') || voidTags.has(tagName);
    const attrString = m[2];

    if (isClosing) {
      if (current.parentElement && current.tagName === tagName) {
        current = current.parentElement;
      }
    } else {
      const el = new SimpleElement(tagName);
      if (attrString) {
        const attrRegex = /([a-zA-Z0-9_\-]+)(?:=["']([^"']*)["'])?/g;
        let am;
        while ((am = attrRegex.exec(attrString)) !== null) {
          el.setAttribute(am[1], am[2] !== undefined ? am[2] : '');
          if (am[1].toLowerCase() === 'value') el.value = am[2] || '';
          if (am[1].toLowerCase() === 'name') el.name = am[2] || '';
        }
      }
      current.appendChild(el);
      if (!isSelfClosing) current = el;
    }
  }
  return root;
}

// -----------------------------------------------------------------------------
// Part 1: Section Static Parity Verification
// -----------------------------------------------------------------------------
console.log('--- Part 1: Section Static Parity Verification ---');

// 1.1 User Accounts Section (08_user_accounts.html)
const sec08Html = fs.readFileSync(path.join(sectionsDir, '08_user_accounts.html'), 'utf8');
const doc08 = parseHtmlFragment(sec08Html);
const accountTable = doc08.querySelector('table');
const dataRows08 = accountTable ? accountTable.querySelectorAll('tr').filter(tr => tr.querySelector('input[name^="AccountName"]')) : [];
const visibleRows08 = dataRows08.filter(tr => !tr.classList.contains('Hidden'));
const hiddenRows08 = dataRows08.filter(tr => tr.classList.contains('Hidden'));
const addMore08 = doc08.querySelectorAll('input.AddMore');

assert('08_user_accounts: total data rows is 15', dataRows08.length === 15, `got ${dataRows08.length}`);
assert('08_user_accounts: initial visible rows is exactly 5', visibleRows08.length === 5, `got ${visibleRows08.length}`);
assert('08_user_accounts: initial hidden rows is exactly 10', hiddenRows08.length === 10, `got ${hiddenRows08.length}`);
assert('08_user_accounts: contains AddMore button', addMore08.length === 1, `got ${addMore08.length}`);

// 1.2 Custom Scripts Section (25_custom_scripts.html)
const sec25Html = fs.readFileSync(path.join(sectionsDir, '25_custom_scripts.html'), 'utf8');
const doc25 = parseHtmlFragment(sec25Html);
const phases = ['SystemScript', 'DefaultUserScript', 'FirstLogonScript', 'UserOnceScript'];
const addMore25 = doc25.querySelectorAll('input.AddMore');

assert('25_custom_scripts: contains 4 AddMore buttons (one per phase)', addMore25.length === 4, `got ${addMore25.length}`);

for (const phase of phases) {
  const phaseLis = doc25.querySelectorAll('li').filter(li => li.querySelector(`[name^="${phase}"]`));
  const visible = phaseLis.filter(li => !li.classList.contains('Hidden'));
  const hidden = phaseLis.filter(li => li.classList.contains('Hidden'));
  assert(`25_custom_scripts (${phase}): total items is 15`, phaseLis.length === 15, `got ${phaseLis.length}`);
  assert(`25_custom_scripts (${phase}): initial visible is exactly 3`, visible.length === 3, `got ${visible.length}`);
  assert(`25_custom_scripts (${phase}): initial hidden is exactly 12`, hidden.length === 12, `got ${hidden.length}`);
}

// 1.3 XML Components Section (27_xml_components.html)
const sec27Html = fs.readFileSync(path.join(sectionsDir, '27_xml_components.html'), 'utf8');
const doc27 = parseHtmlFragment(sec27Html);
const compLis = doc27.querySelectorAll('li').filter(li => li.querySelector('[name^="Component"]'));
const visible27 = compLis.filter(li => !li.classList.contains('Hidden'));
const hidden27 = compLis.filter(li => li.classList.contains('Hidden'));
const addMore27 = doc27.querySelectorAll('input.AddMore');

assert('27_xml_components: total items is 15', compLis.length === 15, `got ${compLis.length}`);
assert('27_xml_components: initial visible is exactly 3', visible27.length === 3, `got ${visible27.length}`);
assert('27_xml_components: initial hidden is exactly 12', hidden27.length === 12, `got ${hidden27.length}`);
assert('27_xml_components: contains AddMore button', addMore27.length === 1, `got ${addMore27.length}`);
// -----------------------------------------------------------------------------
// Part 2: AddMore Dynamic Expansion & State Control Simulation
// -----------------------------------------------------------------------------
console.log('\n--- Part 2: AddMore Dynamic Expansion & State Control Simulation ---');

function simulateAddMoreClick(button, globalDocumentNode) {
  const NodeConst = { DOCUMENT_POSITION_PRECEDING: 2 };
  const getTargetContainer = function (target) {
    let curr = target;
    while (curr && curr.parentElement && (curr.parentElement.tagName === 'FONT' || curr.parentElement.tagName === 'SPAN')) {
      curr = curr.parentElement;
    }
    let sib = curr ? curr.previousElementSibling : null;
    while (sib) {
      if (sib.matches && sib.matches('table, ol')) return sib;
      const inner = sib.querySelector ? sib.querySelector('table, ol') : null;
      if (inner) return inner;
      sib = sib.previousElementSibling;
    }
    const parent = target.closest ? target.closest('td, fieldset, div, form') : (target.parentElement);
    if (parent) {
      const lists = Array.from(parent.querySelectorAll('table, ol'));
      if (lists.length > 0) {
        for (let i = lists.length - 1; i >= 0; i--) {
          const list = lists[i];
          if (target.compareDocumentPosition && (target.compareDocumentPosition(list) & NodeConst.DOCUMENT_POSITION_PRECEDING)) {
            return list;
          }
        }
        return lists[lists.length - 1];
      }
    }
    return null;
  };

  const container = getTargetContainer(button);
  const next = function () {
    return container ? container.querySelector('.Hidden') : null;
  };

  for (let i = 0; i < 3; i++) {
    const n = next();
    if (n) {
      n.classList.remove('Hidden');
    } else {
      break;
    }
  }

  const n = next();
  if (!n) {
    button.disabled = true;
  }
}

// 2.1 Accounts expansion simulation (10 hidden -> 3 unhidden each click -> 4 clicks total)
const simDoc08 = parseHtmlFragment(sec08Html);
const btn08 = simDoc08.querySelector('input.AddMore');
assert('Simulation: Accounts initial disabled is false', btn08.disabled === false);

simulateAddMoreClick(btn08, simDoc08); // click 1: 10 -> 7 hidden
let remHidden = simDoc08.querySelectorAll('tr.Hidden').length;
assert('Simulation: Accounts click 1 unhides 3 (7 remain)', remHidden === 7, `got ${remHidden}`);
assert('Simulation: Accounts button not disabled after click 1', btn08.disabled === false);

simulateAddMoreClick(btn08, simDoc08); // click 2: 7 -> 4 hidden
remHidden = simDoc08.querySelectorAll('tr.Hidden').length;
assert('Simulation: Accounts click 2 unhides 3 (4 remain)', remHidden === 4, `got ${remHidden}`);

simulateAddMoreClick(btn08, simDoc08); // click 3: 4 -> 1 hidden
remHidden = simDoc08.querySelectorAll('tr.Hidden').length;
assert('Simulation: Accounts click 3 unhides 3 (1 remain)', remHidden === 1, `got ${remHidden}`);
assert('Simulation: Accounts button not disabled after click 3', btn08.disabled === false);

simulateAddMoreClick(btn08, simDoc08); // click 4: 1 -> 0 hidden
remHidden = simDoc08.querySelectorAll('tr.Hidden').length;
assert('Simulation: Accounts click 4 unhides last 1 (0 remain)', remHidden === 0, `got ${remHidden}`);
assert('Simulation: Accounts button disabled after all items revealed', btn08.disabled === true);

// -----------------------------------------------------------------------------
// Part 3: Google Translate Multi-wrap Resilience Test
// -----------------------------------------------------------------------------
console.log('\n--- Part 3: Google Translate Multi-wrap Resilience Test ---');

const gtFragmentHtml = `
<fieldset>
  <legend>Scripts</legend>
  <ol>
    <li>Script 0</li>
    <li>Script 1</li>
    <li>Script 2</li>
    <li class="Hidden">Script 3</li>
    <li class="Hidden">Script 4</li>
    <li class="Hidden">Script 5</li>
  </ol>
  <font dir="auto">
    <font dir="auto">
      <input type="button" value="Add more items" class="AddMore" />
    </font>
  </font>
</fieldset>
`;
const gtDoc = parseHtmlFragment(gtFragmentHtml);
const gtBtn = gtDoc.querySelector('input.AddMore');

assert('Google Translate test: AddMore button successfully located inside <font>', gtBtn !== null);
let gtHidden = gtDoc.querySelectorAll('li.Hidden').length;
assert('Google Translate test: Initial hidden items count is 3', gtHidden === 3);

simulateAddMoreClick(gtBtn, gtDoc);

gtHidden = gtDoc.querySelectorAll('li.Hidden').length;
assert('Google Translate test: Successfully traversed past nested <font> tags and unhid 3 items', gtHidden === 0, `got ${gtHidden}`);
assert('Google Translate test: Button is disabled after all items revealed', gtBtn.disabled === true);

// -----------------------------------------------------------------------------
// Part 4: Settings Restoration Auto-unhide Verification
// -----------------------------------------------------------------------------
console.log('\n--- Part 4: Settings Restoration Auto-unhide Verification ---');

const restoreDoc = parseHtmlFragment(sec08Html);
const hiddenTargetTr = restoreDoc.querySelectorAll('tr.Hidden')[0];
const hiddenInput = hiddenTargetTr.querySelector('input[name="AccountName5"]');
assert('Restore test: AccountName5 is initially inside tr.Hidden', hiddenTargetTr.classList.contains('Hidden'));

hiddenInput.value = 'SpecialAdmin';

const allInputs = restoreDoc.querySelectorAll('input, select, textarea');
allInputs.forEach(elem => {
  if (elem.value && elem.value.trim() !== '') {
    const container = elem.closest('tr.Hidden, li.Hidden');
    if (container) {
      container.classList.remove('Hidden');
    }
  }
});

assert('Restore test: Non-empty row automatically removed .Hidden class', !hiddenTargetTr.classList.contains('Hidden'));

console.log('\n====================================================');
console.log(` Results: ${passes} PASSED / ${fails} FAILED`);
console.log('====================================================');
process.exit(fails > 0 ? 1 : 0);

