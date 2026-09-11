/**
 * Lockout modifier matching baseline_unattend_engine.js
 */
function LockoutModifier(context) {
  this.context = context;
}

LockoutModifier.prototype.process = function () {
  var ctx = this.context;
  var lockoutMode = ctx.getVal('LockoutMode', 'Default');
  if (lockoutMode === 'Disabled') {
    ctx.sequences.specialize.append('net.exe accounts /lockoutthreshold:0;');
  } else if (lockoutMode === 'Custom') {
    var thresh = ctx.getVal('LockoutThreshold', '5');
    var dur = ctx.getVal('LockoutDuration', '30');
    var win = ctx.getVal('LockoutWindow', '30');
    ctx.sequences.specialize.append('net.exe accounts /lockoutthreshold:' + thresh + ' /lockoutduration:' + dur + ' /lockoutwindow:' + win + ';');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LockoutModifier: LockoutModifier };
}
