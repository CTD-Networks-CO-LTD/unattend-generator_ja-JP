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

const fd = new MockFormData(inputData);
const xml = engine.generateAutounattendXml(fd);

function assert(condition, message) {
  if (condition) {
    console.log(' [PASS] ' + message);
  } else {
    console.error(' [FAIL] ' + message);
    process.exit(1);
  }
}

// 1. XML 本文への反映
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-01.cmd">'), 'unattend-01.cmd が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-02.reg">'), 'unattend-02.reg が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-03.ps1">'), 'unattend-03.ps1 が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\unattend-04.vbs">'), 'unattend-04.vbs が Extensions/File に存在');

// 2. Reg ヘッダー自動補完
assert(xml.includes('Windows Registry Editor Version 5.00\r\n\r\n[HKU\\DefaultUser\\Test]'), 'unattend-02.reg に Reg ヘッダーが補完');

// 3. 各シーケンスへの呼び出し登録
assert(xml.includes('C:\\Windows\\Setup\\Scripts\\unattend-01.cmd;'), 'Specialize.ps1 に unattend-01.cmd 実行登録');
assert(xml.includes('reg.exe import "C:\\Windows\\Setup\\Scripts\\unattend-02.reg";'), 'DefaultUser.ps1 に reg.exe import 実行登録');
assert(xml.includes("&amp; 'C:\\Windows\\Setup\\Scripts\\unattend-03.ps1';"), 'FirstLogon.ps1 に unattend-03.ps1 実行登録');
assert(xml.includes('cscript.exe //E:vbscript "C:\\Windows\\Setup\\Scripts\\unattend-04.vbs";'), 'UserOnce.ps1 に unattend-04.vbs 実行登録');

// 4. RestartExplorer 再起動ブロック
assert(xml.includes("Get-Process -Name 'explorer' -ErrorAction 'SilentlyContinue'"), 'UserOnce.ps1 に RestartExplorer 処理が存在');

// 5. XML コメントからのクエリ抽出と復元
const query = engine.extractQueryFromXml(xml);
assert(query !== null, 'XML 先頭コメントからクエリ文字列を正常に抽出');
const params = new URLSearchParams(query);
assert(params.get('SystemScript0') === inputData.SystemScript0, 'SystemScript0 がクエリ復元パラメータと一致');
assert(params.get('DefaultUserScript0') === inputData.DefaultUserScript0, 'DefaultUserScript0 がクエリ復元パラメータと一致');
assert(params.get('FirstLogonScript0') === inputData.FirstLogonScript0, 'FirstLogonScript0 がクエリ復元パラメータと一致');
assert(params.get('UserOnceScript0') === inputData.UserOnceScript0, 'UserOnceScript0 がクエリ復元パラメータと一致');
assert(params.get('RestartExplorer') === 'true', 'RestartExplorer がクエリ復元パラメータと一致');

console.log('\n====================================================');
console.log(' 全 11 検証項目 合格！');
console.log('====================================================');
