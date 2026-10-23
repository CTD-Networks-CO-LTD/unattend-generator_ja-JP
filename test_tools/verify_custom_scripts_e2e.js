const fs = require('fs');
const path = require('path');
const engine = require('../docs/unattend_engine.js');

class MockFormData {
  constructor(o) {
    this.d = new Map(Object.entries(o));
  }
  entries() {
    return this.d.entries();
  }
  get(k) {
    return this.d.get(k) || null;
  }
}

console.log('====================================================');
console.log('  Custom Scripts Full Lifecycle E2E Verification');
console.log('====================================================\n');

let passCount = 0;
function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(' [PASS] ' + message);
  } else {
    console.error(' [FAIL] ' + message);
    process.exit(1);
  }
}

// Case 1: 既存基本ライフサイクル検証 (各フェーズ index 0 + RestartExplorer)
const inputData = {
  SystemScript0: 'echo sys0',
  SystemScriptType0: 'Cmd',
  DefaultUserScript0: '[HKU\\DefaultUser\\Test]',
  DefaultUserScriptType0: 'Reg',
  FirstLogonScript0: 'Write-Host "hello firstlogon"',
  FirstLogonScriptType0: 'Ps1',
  UserOnceScript0: 'MsgBox "hello useronce"',
  UserOnceScriptType0: 'Vbs',
  RestartExplorer: 'true'
};

const xml = engine.generateAutounattendXml(new MockFormData(inputData));
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-01.cmd">'), 'unattend-01.cmd が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-02.reg">'), 'unattend-02.reg が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-03.ps1">'), 'unattend-03.ps1 が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-04.vbs">'), 'unattend-04.vbs が Extensions/File に存在');
assert(xml.includes('Windows Registry Editor Version 5.00\r\n\r\n[HKU\\DefaultUser\\Test]'), 'unattend-02.reg に Reg ヘッダーが補完');
assert(xml.includes('C:\\Windows\\Setup\\Scripts\\unattend-01.cmd;'), 'Specialize.ps1 に unattend-01.cmd 実行登録');
assert(xml.includes('reg.exe import "C:\\Windows\\Setup\\Scripts\\unattend-02.reg";'), 'DefaultUser.ps1 に reg.exe import 実行登録');
assert(xml.includes("&amp; 'C:\\Windows\\Setup\\Scripts\\unattend-03.ps1';"), 'FirstLogon.ps1 に unattend-03.ps1 実行登録');
assert(xml.includes('cscript.exe //E:vbscript "C:\\Windows\\Setup\\Scripts\\unattend-04.vbs";'), 'UserOnce.ps1 に unattend-04.vbs 実行登録');
assert(xml.includes("Get-Process -Name 'explorer' -ErrorAction 'SilentlyContinue'"), 'UserOnce.ps1 に RestartExplorer 処理が存在');

const query = engine.extractQueryFromXml(xml);
assert(query !== null, 'XML 先頭コメントからクエリ文字列を正常に抽出');
const params = new URLSearchParams(query);
assert(params.get('SystemScript0') === inputData.SystemScript0, 'SystemScript0 がクエリ復元パラメータと一致');
assert(params.get('DefaultUserScript0') === inputData.DefaultUserScript0, 'DefaultUserScript0 がクエリ復元パラメータと一致');
assert(params.get('FirstLogonScript0') === inputData.FirstLogonScript0, 'FirstLogonScript0 がクエリ復元パラメータと一致');
assert(params.get('UserOnceScript0') === inputData.UserOnceScript0, 'UserOnceScript0 がクエリ復元パラメータと一致');
assert(params.get('RestartExplorer') === 'true', 'RestartExplorer がクエリ復元パラメータと一致');

// Case 2: 直接不具合再現 (FirstLogon: Ps1 x 4 + Cmd x 1 = 計5件)
const inputData2 = {
  FirstLogonScript0: 'Write-Host "Ps1-0"',
  FirstLogonScriptType0: 'Ps1',
  FirstLogonScript1: 'Write-Host "Ps1-1"',
  FirstLogonScriptType1: 'Ps1',
  FirstLogonScript2: 'Write-Host "Ps1-2"',
  FirstLogonScriptType2: 'Ps1',
  FirstLogonScript3: 'Write-Host "Ps1-3"',
  FirstLogonScriptType3: 'Ps1',
  FirstLogonScript4: 'shutdown -r -t 0',
  FirstLogonScriptType4: 'Cmd'
};
const xml2 = engine.generateAutounattendXml(new MockFormData(inputData2));
assert(xml2.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-05.cmd">'), '5件構成: unattend-05.cmd が存在（旧上限4で欠落していた5件目）');
assert(xml2.includes('shutdown -r -t 0'), '5件構成: unattend-05.cmd 本文に shutdown -r -t 0 が存在');
assert(xml2.includes('C:\\Windows\\Setup\\Scripts\\unattend-05.cmd;'), '5件構成: FirstLogon.ps1 に unattend-05.cmd 呼び出しが存在');

// Case 3: 全4フェーズの境界・新上限 (DefaultUser 2/3, 他フェーズ 3/4, 最大枠 14)
const inputData3 = {
  SystemScript4: 'echo sys4',
  SystemScriptType4: 'Cmd',
  DefaultUserScript3: 'echo def3',
  DefaultUserScriptType3: 'Cmd',
  FirstLogonScript4: 'echo fl4',
  FirstLogonScriptType4: 'Cmd',
  UserOnceScript4: 'echo uo4',
  UserOnceScriptType4: 'Cmd',
  SystemScript14: 'echo sys14',
  SystemScriptType14: 'Cmd',
  DefaultUserScript14: 'echo def14',
  DefaultUserScriptType14: 'Cmd',
  FirstLogonScript14: 'echo fl14',
  FirstLogonScriptType14: 'Cmd',
  UserOnceScript14: 'echo uo14',
  UserOnceScriptType14: 'Cmd'
};
const xml3 = engine.generateAutounattendXml(new MockFormData(inputData3));
['sys4', 'def3', 'fl4', 'uo4', 'sys14', 'def14', 'fl14', 'uo14'].forEach(kw => {
  assert(xml3.includes('echo ' + kw), `高位枠スクリプト (${kw}) が生成XMLに反映`);
});

// Case 4: 全枠フル入力検証 (4フェーズ x 15枠 = 60スクリプト、unattend-01〜unattend-3c)
const inputData5 = {};
const phases = ['System', 'DefaultUser', 'FirstLogon', 'UserOnce'];
for (let p = 0; p < phases.length; p++) {
  for (let i = 0; i < 15; i++) {
    inputData5[phases[p] + 'Script' + i] = `echo ${phases[p]}_${i}`;
    inputData5[phases[p] + 'ScriptType' + i] = 'Cmd';
  }
}
const xml5 = engine.generateAutounattendXml(new MockFormData(inputData5));
let allFilesPresent = true;
for (let idx = 1; idx <= 60; idx++) {
  const hex = (idx < 16 ? '0' : '') + idx.toString(16).toLowerCase();
  if (!xml5.includes(`<File path="C:\\Windows\\Setup\\Scripts\\unattend-${hex}.cmd">`)) {
    allFilesPresent = false;
    break;
  }
}
assert(allFilesPresent, '全60スクリプト (unattend-01〜unattend-3c) がExtensions/Fileに漏れなく存在');

// Case 5: HTML UI 整合性ガード (画面15枠とエンジン走査上限の一致)
const htmlPath = path.join(__dirname, '..', 'docs', 'sections', '25_custom_scripts.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');
phases.forEach(phase => {
  const regex = new RegExp(`name="${phase}Script(\\d+)"`, 'g');
  const matches = [];
  let m;
  while ((m = regex.exec(htmlContent)) !== null) {
    matches.push(parseInt(m[1], 10));
  }
  assert(matches.length === 15 && Math.max(...matches) === 14 && Math.min(...matches) === 0,
    `${phase} の HTML textarea が 0〜14 の 15 個存在`);
});

console.log('\n====================================================');
console.log(` 全 ${passCount} 検証項目 合格！`);
console.log('====================================================');
