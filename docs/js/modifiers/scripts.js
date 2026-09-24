/**
 * Scripts modifier matching C# ScriptModifier & baseline_unattend_engine.js
 */
function ScriptsModifier(context) {
  this.context = context;
}

ScriptsModifier.prototype.process = function () {
  var ctx = this.context;

  // 1. Handle RestartExplorer option (C# ScriptModifier)
  if (ctx.getBool('RestartExplorer', false)) {
    ctx.sequences.userOnce.restartExplorer();
  }

  // 2. Process custom scripts across all phases
  var phases = [
    {
      name: 'System',
      sequence: ctx.sequences.specialize,
      count: 4,
      defaultTypes: ['Cmd', 'Ps1', 'Reg', 'Vbs']
    },
    {
      name: 'DefaultUser',
      sequence: ctx.sequences.defaultUser,
      count: 3,
      defaultTypes: ['Reg', 'Cmd', 'Ps1']
    },
    {
      name: 'FirstLogon',
      sequence: ctx.sequences.firstLogon,
      count: 4,
      defaultTypes: ['Cmd', 'Ps1', 'Reg', 'Vbs']
    },
    {
      name: 'UserOnce',
      sequence: ctx.sequences.userOnce,
      count: 4,
      defaultTypes: ['Cmd', 'Ps1', 'Reg', 'Vbs']
    }
  ];

  var scriptIndex = 0;

  for (var p = 0; p < phases.length; p++) {
    var phase = phases[p];
    for (var i = 0; i < phase.count; i++) {
      var scriptKey = phase.name + 'Script' + i;
      var typeKey = phase.name + 'ScriptType' + i;
      var rawContent = ctx.getVal(scriptKey, '');
      if (rawContent && rawContent.trim().length > 0) {
        var content = rawContent.trim();
        var type = ctx.getVal(typeKey, phase.defaultTypes[i] || 'Cmd');

        scriptIndex++;
        var hexIndex = (scriptIndex < 16 ? '0' : '') + scriptIndex.toString(16).toLowerCase();
        var key = 'unattend-' + hexIndex;
        var ext = '.' + type.toLowerCase();
        var fileName = key + ext;
        var filePath = 'C:\\Windows\\Setup\\Scripts\\' + fileName;

        // Clean content for Reg type
        if (type.toLowerCase() === 'reg') {
          var prefix = 'Windows Registry Editor Version 5.00';
          if (content.indexOf(prefix) !== 0) {
            content = prefix + '\r\n\r\n' + content;
          }
        }
        // Normalize line endings to CRLF
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');

        ctx.embedTextFile(fileName, content);

        // Append execution command to the respective phase sequence
        var typeLower = type.toLowerCase();
        if (typeLower === 'ps1') {
          phase.sequence.invokeFile(filePath);
        } else if (typeLower === 'cmd') {
          phase.sequence.append(filePath + ';');
        } else if (typeLower === 'reg') {
          phase.sequence.append('reg.exe import "' + filePath + '";');
        } else if (typeLower === 'vbs') {
          phase.sequence.append('cscript.exe //E:vbscript "' + filePath + '";');
        } else if (typeLower === 'js') {
          phase.sequence.append('cscript.exe //E:jscript "' + filePath + '";');
        }
      }
    }
  }
};

/**
 * Finalize PowerShell sequences into embedded files
 * Corresponds to C# SpecializeModifier, UserOnceModifier, DefaultUserModifier, FirstLogonModifier
 */
function finalizePowerShellSequences(ctx) {
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ScriptsModifier: ScriptsModifier,
    finalizePowerShellSequences: finalizePowerShellSequences
  };
}
