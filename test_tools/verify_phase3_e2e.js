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
console.log('  Phase 3 (Wi-Fi Profile) Full Lifecycle E2E');
console.log('====================================================\n');

const sampleWifiXml = '<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">\r\n  <name>Enterprise-WiFi</name>\r\n  <connectionType>ESS</connectionType>\r\n  <connectionMode>auto</connectionMode>\r\n</WLANProfile>';

const inputData = {
  WifiMode: 'FromProfile',
  WifiProfileXml: sampleWifiXml
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

// 1. Wi-Fi プロファイルの反映
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\Wifi.xml">'), 'Wifi.xml が Extensions/File に存在');
assert(xml.includes('Enterprise-WiFi'), 'Wifi.xml に指定プロファイル内容が埋め込まれている');
assert(xml.includes("Waiting for service '${name}' to start."), 'Specialize.ps1 に WlanSvc 待機ループスクリプトが存在');
assert(xml.includes('netsh.exe wlan add profile filename="C:\\Windows\\Setup\\Scripts\\Wifi.xml" user=all;'), 'Specialize.ps1 に netsh profile 追加コマンドが存在');
assert(xml.includes('netsh.exe wlan connect name="Enterprise-WiFi" ssid="Enterprise-WiFi";'), 'Specialize.ps1 に auto 接続コマンドが存在');
assert(!xml.includes('HideWirelessSetupInOOBE'), 'FromProfile 時に HideWirelessSetupInOOBE 要素が存在しない（削除）');

// 2. XML コメントからのクエリ抽出と復元
const query = engine.extractQueryFromXml(xml);
assert(query !== null, 'XML 先頭コメントからクエリ文字列を正常に抽出');
const params = new URLSearchParams(query);
assert(params.get('WifiMode') === 'FromProfile', 'WifiMode がクエリ復元パラメータと一致');
assert(params.get('WifiProfileXml') === sampleWifiXml, 'WifiProfileXml がクエリ復元パラメータと一致');

console.log('\n====================================================');
console.log(' 全 8 検証項目 合格！');
console.log('====================================================');
