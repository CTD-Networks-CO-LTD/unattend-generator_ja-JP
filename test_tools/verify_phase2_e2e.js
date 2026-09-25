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
console.log('  Phase 2 (StartPins, Taskbar, Wallpaper, LockScreen) Full Lifecycle E2E');
console.log('====================================================\n');

const samplePinsJson = '{"pinnedList":[{"packageId":"Microsoft.WindowsTerminal_8wekyb3d8bbwe!App"}]}';
const sampleTaskbarXml = '<CustomTaskbarLayoutCollection PinListPlacement="Replace"><defaultlayout:TaskbarLayout><taskbar:TaskbarPinList><taskbar:DesktopApp DesktopApplicationLinkPath="%PROGRAMFILES%\\Test.lnk" /></taskbar:TaskbarPinList></defaultlayout:TaskbarLayout></CustomTaskbarLayoutCollection>';
const sampleWallpaperScript = '$url = "https://example.com/wp.jpg"; ( Invoke-WebRequest -Uri $url ).Content;';
const sampleLockScript = '[System.IO.File]::ReadAllBytes("D:\\lock.png");';

const inputData = {
  StartPinsMode: 'Custom',
  StartPinsJson: samplePinsJson,
  TaskbarIconsMode: 'Custom',
  TaskbarIconsXml: sampleTaskbarXml,
  WallpaperMode: 'Script',
  WallpaperScript: sampleWallpaperScript,
  LockScreenMode: 'Script',
  LockScreenScript: sampleLockScript
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

// 1. スタートピン留めの反映
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\SetStartPins.ps1">'), 'SetStartPins.ps1 が Extensions/File に存在');
assert(xml.includes('Microsoft.WindowsTerminal'), 'SetStartPins.ps1 にピン留め JSON が埋め込まれている');
assert(xml.includes("&amp; 'C:\\Windows\\Setup\\Scripts\\SetStartPins.ps1';"), 'Specialize.ps1 に SetStartPins.ps1 呼び出しが存在');

// 2. タスクバーアイコンの反映
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\TaskbarLayoutModification.xml">'), 'TaskbarLayoutModification.xml が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\UnlockStartLayout.vbs">'), 'UnlockStartLayout.vbs が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\UnlockStartLayout.xml">'), 'UnlockStartLayout.xml が Extensions/File に存在');
assert(xml.includes('DisableCloudOptimizedContent'), 'Specialize.ps1 に DisableCloudOptimizedContent 設定が存在');
assert(xml.includes('StartLayoutFile'), 'DefaultUser.ps1 に StartLayoutFile 設定が存在');
assert(xml.includes('LockedStartLayout'), 'DefaultUser.ps1 に LockedStartLayout 設定が存在');
assert(xml.includes("Register-ScheduledTask -TaskName 'UnlockStartLayout'"), 'Specialize.ps1 に UnlockStartLayout タスク登録が存在');
assert(xml.includes("[System.Diagnostics.EventLog]::WriteEntry( 'UnattendGenerator'"), 'UserOnce.ps1 にイベントログ書き込みが存在');

// 3. 壁紙・ロック画面の反映
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\GetWallpaper.ps1">'), 'GetWallpaper.ps1 が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\SetWallpaper.ps1">'), 'SetWallpaper.ps1 が Extensions/File に存在');
assert(xml.includes('<File path="C:\\Windows\\Setup\\Scripts\\GetLockScreenImage.ps1">'), 'GetLockScreenImage.ps1 が Extensions/File に存在');
assert(xml.includes("C:\\Windows\\Setup\\Scripts\\Wallpaper"), 'Specialize.ps1 に壁紙保存処理が存在');
assert(xml.includes("Set-WallpaperImage -LiteralPath 'C:\\Windows\\Setup\\Scripts\\Wallpaper';"), 'SetWallpaper.ps1 末尾に Set-WallpaperImage 呼び出しが存在');
assert(xml.includes("&amp; 'C:\\Windows\\Setup\\Scripts\\SetWallpaper.ps1';"), 'UserOnce.ps1 に SetWallpaper.ps1 呼び出しが存在');
assert(xml.includes('LockScreenImagePath'), 'Specialize.ps1 に LockScreenImagePath 設定が存在');

// 4. XML コメントからのクエリ抽出と復元
const query = engine.extractQueryFromXml(xml);
assert(query !== null, 'XML 先頭コメントからクエリ文字列を正常に抽出');
const params = new URLSearchParams(query);
assert(params.get('StartPinsMode') === 'Custom', 'StartPinsMode がクエリ復元パラメータと一致');
assert(params.get('StartPinsJson') === samplePinsJson, 'StartPinsJson がクエリ復元パラメータと一致');
assert(params.get('TaskbarIconsMode') === 'Custom', 'TaskbarIconsMode がクエリ復元パラメータと一致');
assert(params.get('TaskbarIconsXml') === sampleTaskbarXml, 'TaskbarIconsXml がクエリ復元パラメータと一致');
assert(params.get('WallpaperMode') === 'Script', 'WallpaperMode がクエリ復元パラメータと一致');
assert(params.get('WallpaperScript') === sampleWallpaperScript, 'WallpaperScript がクエリ復元パラメータと一致');
assert(params.get('LockScreenMode') === 'Script', 'LockScreenMode がクエリ復元パラメータと一致');
assert(params.get('LockScreenScript') === sampleLockScript, 'LockScreenScript がクエリ復元パラメータと一致');

console.log('\n====================================================');
console.log(' 全 24 検証項目 合格！');
console.log('====================================================');
