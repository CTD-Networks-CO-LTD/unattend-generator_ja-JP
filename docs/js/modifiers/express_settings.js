/**
 * ExpressSettings modifier matching baseline_unattend_engine.js
 */
function ExpressSettingsModifier(context) {
  this.context = context;
}

ExpressSettingsModifier.prototype.process = function () {
  var ctx = this.context;
  ctx.expressSettings = ctx.getVal('ExpressSettings', 'DisableAll');
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExpressSettingsModifier: ExpressSettingsModifier };
}
