/**
 * Users modifier matching baseline_unattend_engine.js
 */
function UsersModifier(context) {
  this.context = context;
}

UsersModifier.prototype.process = function () {
  var ctx = this.context;
  var userAccountMode = ctx.getVal('UserAccountMode', 'Unattended');
  var autoLogonMode = ctx.getVal('AutoLogonMode', 'Own');
  var obscurePasswords = ctx.getBool('ObscurePasswords', false);
  var accounts = [];

  for (var i = 0; i < 10; i++) {
    var accName = (ctx.formData && typeof ctx.formData.get === 'function') ? ctx.formData.get('AccountName' + i) : null;
    if (accName) {
      accounts.push({
        name: accName,
        displayName: ctx.getVal('AccountDisplayName' + i, ''),
        group: ctx.getVal('AccountGroup' + i, 'Administrators'),
        password: ctx.getVal('AccountPassword' + i, '')
      });
    }
  }
  if (accounts.length === 0 && (userAccountMode === 'Unattended' || ctx.getBool('LocalUser', false))) {
    accounts.push({ name: 'Admin', displayName: '', group: 'Administrators', password: '' });
    accounts.push({ name: 'User', displayName: '', group: 'Users', password: '' });
  }

  ctx.userAccountMode = userAccountMode;
  ctx.autoLogonMode = autoLogonMode;
  ctx.obscurePasswords = obscurePasswords;
  ctx.accounts = accounts;

  if (userAccountMode === 'Unattended' && autoLogonMode !== 'None') {
    ctx.sequences.firstLogon.append("Set-ItemProperty -LiteralPath 'Registry::HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon' -Name 'AutoLogonCount' -Type 'DWord' -Force -Value 0;");
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UsersModifier: UsersModifier };
}
