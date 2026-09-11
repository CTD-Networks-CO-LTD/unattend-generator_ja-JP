/**
 * Delete modifier matching baseline_unattend_engine.js
 */
function DeleteModifier(context) {
  this.context = context;
}

DeleteModifier.prototype.process = function () {
  var ctx = this.context;
  var keepSensitiveFiles = ctx.getBool('KeepSensitiveFiles', false);
  if (!keepSensitiveFiles && ctx.userAccountMode === 'Unattended' && ctx.autoLogonMode !== 'None') {
    ctx.sequences.firstLogon.append([
      'Remove-Item -LiteralPath @(',
      "  'C:\\Windows\\Panther\\unattend.xml';",
      "  'C:\\Windows\\Panther\\unattend-original.xml';",
      "  'C:\\Windows\\Setup\\Scripts\\Wifi.xml';",
      ") -Force -ErrorAction 'SilentlyContinue' -Verbose;"
    ].join('\r\n'));
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DeleteModifier: DeleteModifier };
}
