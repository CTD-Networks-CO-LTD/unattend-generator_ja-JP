/**
 * Personalization modifier matching C# PersonalizationModifier
 * Handles ColorMode, WallpaperMode and LockScreenMode
 */

if (typeof SET_WALLPAPER_PS1 === 'undefined' && typeof require !== 'undefined') {
  var constants = require('../core/constants');
  SET_WALLPAPER_PS1 = constants.SET_WALLPAPER_PS1;
  SET_COLOR_THEME_PS1 = constants.SET_COLOR_THEME_PS1;
}

function PersonalizationModifier(context) {
  this.context = context;
}

PersonalizationModifier.prototype.process = function () {
  var ctx = this.context;
  var userOnceScript = ctx.sequences.userOnce;
  var defaultUserScript = ctx.sequences.defaultUser;
  var specializeScript = ctx.sequences.specialize;

  // 1. Color Settings
  var colorMode = ctx.getVal('ColorMode', 'Default');
  if (colorMode === 'Custom') {
    var sysTheme = ctx.getVal('SystemColorTheme', 'Dark') === 'Light' ? 1 : 0;
    var appsTheme = ctx.getVal('AppsColorTheme', 'Dark') === 'Light' ? 1 : 0;
    var accentOnStart = ctx.getBool('AccentColorOnStart', false) ? 1 : 0;
    var enableTrans = ctx.getBool('EnableTransparency', false) ? 1 : 0;
    var htmlColor = ctx.getVal('AccentColor', '#0078D7').toUpperCase();
    var accentOnBorders = ctx.getBool('AccentColorOnBorders', false) ? 1 : 0;

    var headerLines = [
      '$lightThemeSystem = ' + sysTheme + ';',
      '$lightThemeApps = ' + appsTheme + ';',
      '$accentColorOnStart = ' + accentOnStart + ';',
      '$enableTransparency = ' + enableTrans + ';',
      "$htmlAccentColor = '" + htmlColor + "';"
    ].join('\r\n');

    var colorThemeContent = headerLines + '\r\n' + (typeof SET_COLOR_THEME_PS1 !== 'undefined' ? SET_COLOR_THEME_PS1 : '');
    var colorThemeFile = ctx.embedTextFile('SetColorTheme.ps1', colorThemeContent);

    defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\DWM" /v ColorPrevalence /t REG_DWORD /d ' + accentOnBorders + ' /f;');
    userOnceScript.invokeFile('C:\\Windows\\Setup\\Scripts\\SetColorTheme.ps1');
    userOnceScript.restartExplorer();
  }

  // 2. Desktop Wallpaper
  var wallpaperMode = ctx.getVal('WallpaperMode', 'Default');
  if (wallpaperMode === 'Script') {
    var wallpaperScript = ctx.getVal('WallpaperScript', '');
    if (wallpaperScript && wallpaperScript.trim()) {
      var imageFile = 'C:\\Windows\\Setup\\Scripts\\Wallpaper';
      var cleanScript = wallpaperScript.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
      var getterFile = ctx.embedTextFile('GetWallpaper.ps1', cleanScript);
      specializeScript.append(
        "try {\r\n" +
        "  $bytes = & '" + getterFile + "';\r\n" +
        "  [System.IO.File]::WriteAllBytes( '" + imageFile + "', $bytes );\r\n" +
        "} catch {\r\n" +
        "  $_;\r\n" +
        "}"
      );
      var wpScriptContent = (typeof SET_WALLPAPER_PS1 !== 'undefined' ? SET_WALLPAPER_PS1 : '') + "\r\nSet-WallpaperImage -LiteralPath '" + imageFile + "';";
      var wpFile = ctx.embedTextFile('SetWallpaper.ps1', wpScriptContent);
      userOnceScript.invokeFile(wpFile);
    }
  } else if (wallpaperMode === 'Solid') {
    var wallpaperColor = ctx.getVal('WallpaperColor', '#000000');
    var wpSolidContent = (typeof SET_WALLPAPER_PS1 !== 'undefined' ? SET_WALLPAPER_PS1 : '') + "\r\nSet-WallpaperColor -HtmlColor '" + wallpaperColor + "';";
    var wpSolidFile = ctx.embedTextFile('SetWallpaper.ps1', wpSolidContent);
    userOnceScript.invokeFile(wpSolidFile);
  }

  // 3. Lock Screen Image
  var lockScreenMode = ctx.getVal('LockScreenMode', 'Default');
  if (lockScreenMode === 'Script') {
    var lockScreenScript = ctx.getVal('LockScreenScript', '');
    if (lockScreenScript && lockScreenScript.trim()) {
      var lockImageFile = 'C:\\Windows\\Setup\\Scripts\\LockScreenImage';
      var cleanLockScript = lockScreenScript.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
      var lockGetterFile = ctx.embedTextFile('GetLockScreenImage.ps1', cleanLockScript);
      specializeScript.append(
        "try {\r\n" +
        "  $bytes = & '" + lockGetterFile + "';\r\n" +
        "  [System.IO.File]::WriteAllBytes( '" + lockImageFile + "', $bytes );\r\n" +
        '  reg.exe add "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\PersonalizationCSP" /v LockScreenImagePath /t REG_SZ /d "' + lockImageFile + '" /f;\r\n' +
        "} catch {\r\n" +
        "  $_;\r\n" +
        "}"
      );
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PersonalizationModifier: PersonalizationModifier
  };
}
