/**
 * AppLocker modifier matching C# AppLockerModifier
 * Handles AppLockerMode === 'Configure' and embeds AppLockerPolicy.xml
 */
function AppLockerModifier(context) {
  this.context = context;
}

AppLockerModifier.prototype.process = function () {
  var ctx = this.context;
  var mode = ctx.getVal('AppLockerMode', 'Skip');
  if (mode !== 'Configure') {
    return;
  }

  var rawPolicyXml = ctx.getVal('AppLockerPolicyXml', '');
  if (!rawPolicyXml || !rawPolicyXml.trim()) {
    return;
  }

  // Normalize line endings to CRLF
  var policyXml = rawPolicyXml.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');

  var xmlFile = ctx.embedTextFile('AppLockerPolicy.xml', policyXml);

  ctx.sequences.specialize.append(
    "Get-Service -Name 'AppIDSvc' | Set-Service -StartupType 'Automatic';\r\n" +
    "Get-Service -Name 'AppIDSvc' | Start-Service;\r\n" +
    "Set-AppLockerPolicy -XmlPolicy '" + xmlFile + "';"
  );
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AppLockerModifier: AppLockerModifier
  };
}
