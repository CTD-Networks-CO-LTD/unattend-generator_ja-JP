/**
 * ProductKey modifier matching baseline_unattend_engine.js
 */
function ProductKeyModifier(context) {
  this.context = context;
}

ProductKeyModifier.prototype.process = function () {
  var ctx = this.context;
  ctx.peMode = ctx.getVal('PEMode', 'Default');
  ctx.winEditionMode = ctx.getVal('WindowsEditionMode', 'Interactive');
  ctx.productKeyVal = ctx.getVal('ProductKey', '00000-00000-00000-00000-00000');
  ctx.useConfigurationSet = ctx.getBool('UseConfigurationSet', false);
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProductKeyModifier: ProductKeyModifier };
}
