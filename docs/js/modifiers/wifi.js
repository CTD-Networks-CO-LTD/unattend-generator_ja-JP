/**
 * Wifi modifier matching baseline_unattend_engine.js
 */
function WifiModifier(context) {
  this.context = context;
}

WifiModifier.prototype.process = function () {
  // Baseline does not generate additional XML for Wifi settings
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WifiModifier: WifiModifier };
}
