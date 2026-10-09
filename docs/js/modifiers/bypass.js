/**
 * Bypass modifier matching baseline_unattend_engine.js
 */
function BypassModifier(context) {
  this.context = context;
}

BypassModifier.prototype.process = function () {
  var ctx = this.context;
  ctx.bypassRequirements = ctx.getBool('BypassRequirementsCheck', false);
  ctx.bypassNetwork = ctx.getBool('BypassNetworkCheck', false);
  if (ctx.bypassNetwork) {
    ctx.sequences.specialize.append('reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\OOBE" /v BypassNRO /t REG_DWORD /d 1 /f;');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BypassModifier: BypassModifier };
}
