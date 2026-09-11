/**
 * Scripts modifier matching baseline_unattend_engine.js
 */
function ScriptsModifier(context) {
  this.context = context;
}

ScriptsModifier.prototype.process = function () {
  var ctx = this.context;
  var userOnceScript = ctx.sequences.userOnce;
  var defaultUserScript = ctx.sequences.defaultUser;
  var specializeScript = ctx.sequences.specialize;
  var firstLogonScript = ctx.sequences.firstLogon;

  if (!userOnceScript.isEmpty()) {
    var userOnceFile = ctx.embedTextFile('UserOnce.ps1', userOnceScript.getScript());
    var cmdEscaped = ('powershell.exe -WindowStyle "Normal" -ExecutionPolicy "Unrestricted" -NoProfile -File "' + userOnceFile + '"').replace(/"/g, '\\\"');
    defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce" /v "UnattendedSetup" /t REG_SZ /d "' + cmdEscaped + '" /f;');
  }
  if (!defaultUserScript.isEmpty()) {
    var defUserFile = ctx.embedTextFile('DefaultUser.ps1', defaultUserScript.getScript());
    specializeScript.append('reg.exe load "HKU\\DefaultUser" "C:\\Users\\Default\\NTUSER.DAT";');
    specializeScript.invokeFile(defUserFile);
    specializeScript.append('reg.exe unload "HKU\\DefaultUser";');
  }

  var specializeFile = null;
  if (!specializeScript.isEmpty()) {
    specializeFile = ctx.embedTextFile('Specialize.ps1', specializeScript.getScript());
  }
  var firstLogonFile = null;
  if (!firstLogonScript.isEmpty()) {
    firstLogonFile = ctx.embedTextFile('FirstLogon.ps1', firstLogonScript.getScript());
  }

  ctx.specializeFile = specializeFile;
  ctx.firstLogonFile = firstLogonFile;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ScriptsModifier: ScriptsModifier };
}
