/**
 * TimeZone modifier matching baseline_unattend_engine.js
 */
function TimeZoneModifier(context) {
  this.context = context;
}

TimeZoneModifier.prototype.process = function () {
  var ctx = this.context;
  ctx.tzMode = ctx.getVal('TimeZoneMode', 'Implicit');
  ctx.tzId = ctx.getVal('TimeZone', '');
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TimeZoneModifier: TimeZoneModifier };
}
