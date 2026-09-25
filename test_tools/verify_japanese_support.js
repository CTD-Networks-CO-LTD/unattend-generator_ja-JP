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
console.log('  日本語キーボード・日本語環境 継続検証テスト');
console.log('====================================================\n');

function assert(condition, message) {
  if (condition) {
    console.log(' [PASS] ' + message);
  } else {
    console.error(' [FAIL] ' + message);
    process.exit(1);
  }
}

// Case 1: PEMode = 'Default' (従来の対話型セットアップ)
console.log('--- Test A: PEMode = Default での日本語キーボード検証 ---');
const fdDefault = new MockFormData({
  PEMode: 'Default',
  LanguageMode: 'Unattended',
  UILanguage: 'ja-JP',
  Locale: 'ja-JP',
  Keyboard: '00000411',
  GeoLocation: '122'
});
const xmlDefault = engine.generateAutounattendXml(fdDefault);

assert(xmlDefault.includes('<LayeredDriver>1</LayeredDriver>'), 'windowsPE に LayeredDriver 1 が存在すること (PR #4)');
assert(!xmlDefault.includes('<settings pass="oobeSystem">\r\n\t\t<component name="Microsoft-Windows-International-Core">\r\n\t\t\t<LayeredDriver>'), 'oobeSystem に不正な LayeredDriver が含まれないこと (PR #5)');
assert(xmlDefault.includes('kbd106.dll') && xmlDefault.includes('PCAT_106KEY'), 'specialize / firstLogon に kbd106.dll / PCAT_106KEY レジストリ設定が存在すること (PR #6)');
assert(xmlDefault.includes('OverrideKeyboardSubtype') && xmlDefault.includes('OverrideKeyboardType'), 'キーボードサブタイプ2 / タイプ7 設定が存在すること (PR #6)');
assert(xmlDefault.includes('New-WinUserLanguageList') && xmlDefault.includes('Copy-UserInternationalSettingsToSystem'), '言語リスト永続化およびシステム設定コピー処理が存在すること (PR #7)');

// Case 2: PEMode = 'Generated' (今回の改修対象: 自動スクリプト生成)
console.log('\n--- Test B: PEMode = Generated での日本語キーボード・日本語環境検証 ---');
const fdGenerated = new MockFormData({
  PEMode: 'Generated',
  LanguageMode: 'Unattended',
  UILanguage: 'ja-JP',
  Locale: 'ja-JP',
  Keyboard: '00000411',
  GeoLocation: '122'
});
const xmlGenerated = engine.generateAutounattendXml(fdGenerated);

assert(xmlGenerated.includes('wpeutil.exe SetKeyboardLayout 0411:00000411'), 'pe.cmd 内で PE セッション用に 0411:00000411 が設定されていること');
assert(xmlGenerated.includes('kbd106.dll') && xmlGenerated.includes('PCAT_106KEY'), 'PEMode: Generated 時も kbd106.dll / PCAT_106KEY レジストリ設定が存在すること (PR #6 継続)');
assert(xmlGenerated.includes('OverrideKeyboardSubtype') && xmlGenerated.includes('OverrideKeyboardType'), 'PEMode: Generated 時もキーボードサブタイプ2 / タイプ7 が存在すること (PR #6 継続)');
assert(xmlGenerated.includes('New-WinUserLanguageList') && xmlGenerated.includes('Copy-UserInternationalSettingsToSystem'), 'PEMode: Generated 時も言語リスト永続化が存在すること (PR #7 継続)');
assert(xmlGenerated.includes('Setting device setup region to Japan (GeoID 122)'), 'pe.cmd 内で日本の地域設定 (GeoID 122) が反映されていること');
assert(xmlGenerated.includes('DeviceRegion /t REG_DWORD /d 122 /f'), 'pe.cmd 内で DeviceRegion レジストリに GeoID 122 が書き込まれること');

console.log('\n====================================================');
console.log(' 全 11 検証項目 合格！ 日本語対応は完全に継続されています。');
console.log('====================================================');
