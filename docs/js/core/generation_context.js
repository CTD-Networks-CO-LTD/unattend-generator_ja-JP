/**
 * GenerationContext matching C# ModifierContext
 * Holds XML DOM nodes, script sequences, and shared state across modifiers
 */
function GenerationContext(formData) {
  if (!formData && typeof document !== 'undefined') {
    var defaultForm = getMainForm();
    if (defaultForm) formData = new FormData(defaultForm);
  } else if (formData && typeof HTMLFormElement !== 'undefined' && formData instanceof HTMLFormElement) {
    formData = new FormData(formData);
  } else if (typeof formData === 'string') {
    formData = new URLSearchParams(formData.indexOf('?') !== -1 ? formData.split('?')[1] : formData);
  }

  this.formData = formData;

  // Root XML document matching C# autounattend.xml resource
  this.xml = new XmlNode('unattend', {
    'xmlns': 'urn:schemas-microsoft-com:unattend',
    'xmlns:wcm': 'http://schemas.microsoft.com/WMIConfig/2002/State'
  });

  // Windows Setup configuration passes matching C# Pass enum
  this.passes = {
    offlineServicing: this.xml.addChild(new XmlNode('settings', { 'pass': 'offlineServicing' })),
    windowsPE: this.xml.addChild(new XmlNode('settings', { 'pass': 'windowsPE' })),
    generalize: this.xml.addChild(new XmlNode('settings', { 'pass': 'generalize' })),
    specialize: this.xml.addChild(new XmlNode('settings', { 'pass': 'specialize' })),
    auditSystem: this.xml.addChild(new XmlNode('settings', { 'pass': 'auditSystem' })),
    auditUser: this.xml.addChild(new XmlNode('settings', { 'pass': 'auditUser' })),
    oobeSystem: this.xml.addChild(new XmlNode('settings', { 'pass': 'oobeSystem' }))
  };

  // PowerShell Sequences matching C# SpecializeSequence, FirstLogonSequence, UserOnceSequence, DefaultUserSequence
  this.sequences = {
    specialize: new PowerShellSequence('Running scripts to customize your Windows installation.', 'C:\\Windows\\Setup\\Scripts\\Specialize.log'),
    firstLogon: new PowerShellSequence('Running scripts to finalize your Windows installation.', 'C:\\Windows\\Setup\\Scripts\\FirstLogon.log'),
    userOnce: new PowerShellSequence('Running scripts to configure this user account.', '$env:TEMP\\UserOnce.log'),
    defaultUser: new PowerShellSequence('Running scripts to modify default user registry hive.', 'C:\\Windows\\Setup\\Scripts\\DefaultUser.log')
  };

  this.embeddedFiles = [];
  this.hasExtractScript = false;
  this.commitHash = 'f1ce9a9d75259173f0a3f2ef8c84230c731986d9';

  // Shared state populated and consumed across modifiers
  this.arch = this.getVal('ProcessorArchitecture', 'amd64');
  this.specCompName = null;
  this.accounts = [];
  this.specializeFile = null;
  this.firstLogonFile = null;
  this.userOnceFile = null;
  this.defaultUserFile = null;
}

GenerationContext.prototype.getVal = function (name, def) {
  if (!this.formData || typeof this.formData.get !== 'function') return def;
  var val = this.formData.get(name);
  return (val !== null && val !== undefined && val !== '') ? val : def;
};

GenerationContext.prototype.getBool = function (name, def) {
  if (!this.formData || typeof this.formData.get !== 'function') return !!def;
  var val = this.formData.get(name);
  if (val === null || val === undefined) return !!def;
  return val === 'true' || val === 'on' || val === '1';
};

GenerationContext.prototype.embedTextFile = function (name, content) {
  var path = name.indexOf('\\') !== -1 ? name : 'C:\\Windows\\Setup\\Scripts\\' + name;
  this.embeddedFiles.push({ path: path, content: content });
  this.hasExtractScript = true;
  return path;
};
