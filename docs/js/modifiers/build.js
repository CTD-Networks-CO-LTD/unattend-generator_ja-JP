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
    var urlBase = (typeof COMMIT_URL_BASE !== 'undefined' ? COMMIT_URL_BASE : 'https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP/commit/');
    commitElem.addSimpleElement('Hash', ctx.commitHash);
    commitElem.addSimpleElement('GitHubUrl', urlBase + ctx.commitHash);

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
