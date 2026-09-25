/**
 * Personalization modifier matching C# PersonalizationModifier
 * Handles WallpaperMode and LockScreenMode custom scripts
 */

if (typeof SET_WALLPAPER_PS1 === 'undefined' && typeof require !== 'undefined') {
  var constants = require('../core/constants');
  SET_WALLPAPER_PS1 = constants.SET_WALLPAPER_PS1;
}

function PersonalizationModifier(context) {
  this.context = context;
}

PersonalizationModifier.prototype.process = function () {
  var ctx = this.context;

  // Desktop Wallpaper
  var wallpaperMode = ctx.getVal('WallpaperMode', 'Default');
  if (wallpaperMode === 'Script') {
    var wallpaperScript = ctx.getVal('WallpaperScript', '');
    if (wallpaperScript && wallpaperScript.trim()) {
      var imageFile = 'C:\\Windows\\Setup\\Scripts\\Wallpaper';
      var cleanScript = wallpaperScript.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
      var getterFile = ctx.embedTextFile('GetWallpaper.ps1', cleanScript);
      ctx.sequences.specialize.append(
        "try {\r\n" +
        "  $bytes = & '" + getterFile + "';\r\n" +
        "  [System.IO.File]::WriteAllBytes( '" + imageFile + "', $bytes );\r\n" +
        "} catch {\r\n" +
        "  $_;\r\n" +
        "}"
      );
      var wpScriptContent = SET_WALLPAPER_PS1 + "\r\nSet-WallpaperImage -LiteralPath '" + imageFile + "';";
      var wpFile = ctx.embedTextFile('SetWallpaper.ps1', wpScriptContent);
      ctx.sequences.userOnce.invokeFile(wpFile);
    }
  }

  // Lock Screen Image
  var lockScreenMode = ctx.getVal('LockScreenMode', 'Default');
  if (lockScreenMode === 'Script') {
    var lockScreenScript = ctx.getVal('LockScreenScript', '');
    if (lockScreenScript && lockScreenScript.trim()) {
      var lockImageFile = 'C:\\Windows\\Setup\\Scripts\\LockScreenImage';
      var cleanLockScript = lockScreenScript.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
      var lockGetterFile = ctx.embedTextFile('GetLockScreenImage.ps1', cleanLockScript);
      ctx.sequences.specialize.append(
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
