/**
 * Computer name modifier matching baseline_unattend_engine.js
 */
function ComputerNameModifier(context) {
  this.context = context;
}

ComputerNameModifier.prototype.process = function () {
  var ctx = this.context;
  var compNameMode = ctx.getVal('ComputerNameMode', 'Random');
  var customCompName = ctx.getVal('ComputerName', '');
  var compNameScript = ctx.getVal('ComputerNameScript', '');
  var specCompName = null;

  if (compNameMode === 'Custom' && customCompName) {
    specCompName = customCompName;
  } else if (compNameMode === 'Script' && compNameScript) {
    specCompName = 'TEMPNAME';
    var getterFile = ctx.embedTextFile('GetComputerName.ps1', compNameScript);
    var setterFile = ctx.embedTextFile('SetComputerName.ps1', SET_COMPUTER_NAME_PS1);
    ctx.sequences.specialize.append([
      "[string] $newName = & '" + getterFile + "';",
      "$newName > 'C:\\Windows\\Setup\\Scripts\\ComputerName.txt';",
      '"Will set the computer name to \'${newName}\'.";',
      'Start-Process -FilePath ( Get-Process -Id $PID ).Path -ArgumentList \'-ExecutionPolicy "Unrestricted" -NoProfile -File "' + setterFile + '"\' -WindowStyle \'Hidden\';',
      'Start-Sleep -Seconds 10;'
    ].join('\r\n'));
  }

  ctx.specCompName = specCompName;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ComputerNameModifier: ComputerNameModifier };
}
