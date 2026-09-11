/**
 * Build modifier matching baseline_unattend_engine.js
 */
function BuildModifier(context) {
  this.context = context;
}

BuildModifier.prototype.process = function (root) {
  var ctx = this.context;
  if (ctx.hasExtractScript || ctx.embeddedFiles.length > 0) {
    var extensionsElem = root.addChild(new XmlNode('Extensions', {
      'xmlns': 'https://schneegans.de/windows/unattend-generator/'
    }));

    var buildElem = extensionsElem.addChild(new XmlNode('Build'));
    var commitElem = buildElem.addChild(new XmlNode('Commit'));
    commitElem.addSimpleElement('Hash', ctx.commitHash);
    commitElem.addSimpleElement('GitHubUrl', 'https://github.com/cschneegans/unattend-generator/commit/' + ctx.commitHash);

    if (ctx.hasExtractScript) {
      var extractScriptElem = extensionsElem.addChild(new XmlNode('ExtractScript'));
      extractScriptElem.addChild(new XmlNode(EXTRACT_SCRIPTS_PS1, null, null, true));
    }

    for (var f = 0; f < ctx.embeddedFiles.length; f++) {
      var fileElem = extensionsElem.addChild(new XmlNode('File', { 'path': ctx.embeddedFiles[f].path }));
      fileElem.addChild(new XmlNode(ctx.embeddedFiles[f].content, null, null, true));
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BuildModifier: BuildModifier };
}
