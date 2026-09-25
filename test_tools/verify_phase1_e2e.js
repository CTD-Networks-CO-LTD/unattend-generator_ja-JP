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
console.log('  Phase 1 (AppLocker + Components) Full Lifecycle E2E');
console.log('====================================================\n');

const policyXmlInput = '<AppLockerPolicy Version="1">\r\n  <RuleCollection Type="Appx" EnforcementMode="Enabled" />\r\n</AppLockerPolicy>';
const comp0Markup = '<AudioSetting action="enable"><Volume>95</Volume></AudioSetting>';
const comp1Markup = '<Data>CodeIntegrityTest</Data>';

const inputData = {
  AppLockerMode: 'Configure',
  AppLockerPolicyXml: policyXmlInput,
  Component0: 'Microsoft-Windows-Audio-AudioCore-specialize',
  ComponentContent0: comp0Markup,
  Component1: 'Microsoft-Windows-CodeIntegrity-offlineServicing',
  ComponentContent1: comp1Markup
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

// 1. AppLocker の XML 本文への反映
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\AppLockerPolicy.xml">'), 'AppLockerPolicy.xml が Extensions/File に存在');
assert(xml.includes('&lt;AppLockerPolicy Version="1"&gt;'), 'AppLockerPolicy.xml の XML 内容がエスケープされて埋め込まれている');
assert(xml.includes("Get-Service -Name 'AppIDSvc' | Set-Service -StartupType 'Automatic';"), 'Specialize.ps1 に AppIDSvc 自動起動コマンドが存在');
assert(xml.includes("Get-Service -Name 'AppIDSvc' | Start-Service;"), 'Specialize.ps1 に AppIDSvc 開始コマンドが存在');
assert(xml.includes("Set-AppLockerPolicy -XmlPolicy 'C:\\Windows\\Setup\\Scripts\\AppLockerPolicy.xml';"), 'Specialize.ps1 に Set-AppLockerPolicy 実行コマンドが存在');

// 2. 追加コンポーネント (Components) の XML 本文への反映
assert(xml.includes('<settings pass="specialize">'), 'specialize pass が存在');
assert(xml.includes('<component name="Microsoft-Windows-Audio-AudioCore" processorArchitecture="x86" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">'), 'Microsoft-Windows-Audio-AudioCore コンポーネントが生成されている');
assert(xml.includes('<AudioSetting action="enable">'), '<AudioSetting> 要素が出力されている');
assert(xml.includes('<Volume>95</Volume>'), '<Volume> 要素が出力されている');

assert(xml.includes('<settings pass="offlineServicing">'), 'offlineServicing pass が存在');
assert(xml.includes('<component name="Microsoft-Windows-CodeIntegrity" processorArchitecture="x86" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">'), 'Microsoft-Windows-CodeIntegrity コンポーネントが生成されている');
assert(xml.includes('<Data>CodeIntegrityTest</Data>'), '<Data> 要素が出力されている');

// 3. XML コメントからのクエリ抽出と復元
const query = engine.extractQueryFromXml(xml);
assert(query !== null, 'XML 先頭コメントからクエリ文字列を正常に抽出');
const params = new URLSearchParams(query);
assert(params.get('AppLockerMode') === 'Configure', 'AppLockerMode がクエリ復元パラメータと一致');
assert(params.get('AppLockerPolicyXml') === policyXmlInput, 'AppLockerPolicyXml がクエリ復元パラメータと一致');
assert(params.get('Component0') === inputData.Component0, 'Component0 がクエリ復元パラメータと一致');
assert(params.get('ComponentContent0') === comp0Markup, 'ComponentContent0 がクエリ復元パラメータと一致');
assert(params.get('Component1') === inputData.Component1, 'Component1 がクエリ復元パラメータと一致');
assert(params.get('ComponentContent1') === comp1Markup, 'ComponentContent1 がクエリ復元パラメータと一致');

console.log('\n====================================================');
console.log(' 全 17 検証項目 合格！');
console.log('====================================================');
