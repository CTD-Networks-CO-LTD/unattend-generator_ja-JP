/**
 * Password expiration modifier matching baseline_unattend_engine.js
 */
function PasswordExpirationModifier(context) {
  this.context = context;
}

PasswordExpirationModifier.prototype.process = function () {
  var ctx = this.context;
  var pwExpMode = ctx.getVal('PasswordExpirationMode', 'Unlimited');
  if (pwExpMode === 'Unlimited') {
    ctx.sequences.specialize.append('net.exe accounts /maxpwage:UNLIMITED;');
  } else if (pwExpMode === 'Custom') {
    var maxAge = ctx.getVal('PasswordExpirationDays', '42');
    ctx.sequences.specialize.append('net.exe accounts /maxpwage:' + maxAge + ';');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PasswordExpirationModifier: PasswordExpirationModifier };
}
