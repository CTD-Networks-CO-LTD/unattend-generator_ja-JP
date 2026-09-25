/**
 * UnattendEngine coordinator executing modifier pipeline matching baseline_unattend_engine.js
 */
function generateAutounattendXml(formData) {
  var context = new GenerationContext(formData);

  if (typeof AppLockerModifier === 'undefined' && typeof require !== 'undefined') {
    AppLockerModifier = require('./modifiers/applocker').AppLockerModifier;
  }
  if (typeof ComponentsModifier === 'undefined' && typeof require !== 'undefined') {
    ComponentsModifier = require('./modifiers/components').ComponentsModifier;
  }
  if (typeof PersonalizationModifier === 'undefined' && typeof require !== 'undefined') {
    PersonalizationModifier = require('./modifiers/personalization').PersonalizationModifier;
  }

  var componentsMod = new ComponentsModifier(context);

  // Execute modifier pipeline in C# matching sequence
  var modifiers = [
    new ComputerNameModifier(context),
    new PasswordExpirationModifier(context),
    new LockoutModifier(context),
    new UsersModifier(context),
    new OptimizationsModifier(context),
    new PersonalizationModifier(context),
    new BloatwareModifier(context),
    new LocalesModifier(context),
    new BypassModifier(context),
    new ProductKeyModifier(context),
    new TimeZoneModifier(context),
    new ExpressSettingsModifier(context),
    new WifiModifier(context),
    new AppLockerModifier(context),
    new ScriptsModifier(context),
    new DeleteModifier(context),
    componentsMod
  ];

  for (var i = 0; i < modifiers.length; i++) {
    modifiers[i].process();
  }

  // Finalize PowerShell sequences into embedded files
  if (typeof finalizePowerShellSequences === 'function') {
    finalizePowerShellSequences(context);
  } else if (typeof require !== 'undefined') {
    var scriptsMod = require('./modifiers/scripts');
    scriptsMod.finalizePowerShellSequences(context);
  }

  // Construct XML Hierarchy
    var root = new XmlNode('unattend', {
      'xmlns': 'urn:schemas-microsoft-com:unattend',
      'xmlns:wcm': 'http://schemas.microsoft.com/WMIConfig/2002/State'
    });

    // 1. pass="offlineServicing"
    var offlineServicingSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'offlineServicing' }));

    // 2. pass="windowsPE"
    var peSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'windowsPE' }));
    if (context.langMode === 'Unattended') {
      var peIntl = peSettingsElem.addChild(new XmlNode('component', {
        'name': 'Microsoft-Windows-International-Core-WinPE',
        'processorArchitecture': context.arch,
        'publicKeyToken': '31bf3856ad364e35',
        'language': 'neutral',
        'versionScope': 'nonSxS'
      }));
      if (context.isJapaneseKeyboard) {
        var peInputLocStr = context.keyboard;
        if (context.keyboard.indexOf('{') === -1 && context.keyboard.length === 8) {
          var peLcidPrefix = context.keyboard.substring(4);
          peInputLocStr = peLcidPrefix + ':' + context.keyboard;
        }
        peIntl.addSimpleElement('InputLocale', peInputLocStr);
        peIntl.addSimpleElement('SystemLocale', context.locale);
        peIntl.addSimpleElement('UILanguage', context.uiLang);
        peIntl.addSimpleElement('UserLocale', context.locale);
        peIntl.addSimpleElement('LayeredDriver', '1');
      } else {
        peIntl.addSimpleElement('UILanguage', context.uiLang);
      }
    }

    var winSetup = peSettingsElem.addChild(new XmlNode('component', {
      'name': 'Microsoft-Windows-Setup',
      'processorArchitecture': context.arch,
      'publicKeyToken': '31bf3856ad364e35',
      'language': 'neutral',
      'versionScope': 'nonSxS'
    }));

    if (context.bypassRequirements) {
      var peRunSync = winSetup.addChild(new XmlNode('RunSynchronous'));
      var bypassKeys = ['BypassTPMCheck', 'BypassSecureBootCheck', 'BypassRAMCheck'];
      for (var b = 0; b < bypassKeys.length; b++) {
        var syncCmd = peRunSync.addChild(new XmlNode('RunSynchronousCommand', { 'wcm:action': 'add' }));
        syncCmd.addSimpleElement('Order', String(b + 1));
        syncCmd.addSimpleElement('Path', 'reg.exe add "HKLM\\SYSTEM\\Setup\\LabConfig" /v ' + bypassKeys[b] + ' /t REG_DWORD /d 1 /f');
      }
    }

    var userData = winSetup.addChild(new XmlNode('UserData'));
    var prodKeyElem = userData.addChild(new XmlNode('ProductKey'));
    if (context.winEditionMode === 'Interactive') {
      prodKeyElem.addSimpleElement('Key', '00000-00000-00000-00000-00000');
      prodKeyElem.addSimpleElement('WillShowUI', 'Always');
    } else if (context.winEditionMode === 'Custom' && context.productKeyVal) {
      prodKeyElem.addSimpleElement('Key', context.productKeyVal);
      prodKeyElem.addSimpleElement('WillShowUI', 'OnError');
    } else if (context.winEditionMode === 'Firmware') {
      prodKeyElem.addSimpleElement('WillShowUI', 'Never');
    } else {
      prodKeyElem.addSimpleElement('Key', context.productKeyVal || '00000-00000-00000-00000-00000');
      prodKeyElem.addSimpleElement('WillShowUI', 'OnError');
    }
    userData.addSimpleElement('AcceptEula', 'true');
    winSetup.addSimpleElement('UseConfigurationSet', context.useConfigurationSet ? 'true' : 'false');

    // 3. pass="generalize"
    var generalizeSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'generalize' }));

    // 4. pass="specialize"
    var specSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'specialize' }));
    if (context.specCompName || (context.tzMode === 'Explicit' && context.tzId)) {
      var specShell = specSettingsElem.addChild(new XmlNode('component', {
        'name': 'Microsoft-Windows-Shell-Setup',
        'processorArchitecture': context.arch,
        'publicKeyToken': '31bf3856ad364e35',
        'language': 'neutral',
        'versionScope': 'nonSxS'
      }));
      if (context.specCompName) {
        specShell.addSimpleElement('ComputerName', context.specCompName);
      }
      if (context.tzMode === 'Explicit' && context.tzId) {
        specShell.addSimpleElement('TimeZone', context.tzId);
      }
    }

    if (context.hasExtractScript || context.specializeFile) {
      var specDeploy = specSettingsElem.addChild(new XmlNode('component', {
        'name': 'Microsoft-Windows-Deployment',
        'processorArchitecture': context.arch,
        'publicKeyToken': '31bf3856ad364e35',
        'language': 'neutral',
        'versionScope': 'nonSxS'
      }));
      var runSync = specDeploy.addChild(new XmlNode('RunSynchronous'));
      var orderNum = 1;
      if (context.hasExtractScript) {
        var extractCmd = runSync.addChild(new XmlNode('RunSynchronousCommand', { 'wcm:action': 'add' }));
        extractCmd.addSimpleElement('Order', String(orderNum++));
        extractCmd.addSimpleElement('Path', 'powershell.exe -WindowStyle "Normal" -NoProfile -Command "$xml = [xml]::new(); $xml.Load(\'C:\\Windows\\Panther\\unattend.xml\'); $sb = [scriptblock]::Create( $xml.unattend.Extensions.ExtractScript ); Invoke-Command -ScriptBlock $sb -ArgumentList $xml;"');
      }
      if (context.specializeFile) {
        var specCmd = runSync.addChild(new XmlNode('RunSynchronousCommand', { 'wcm:action': 'add' }));
        specCmd.addSimpleElement('Order', String(orderNum++));
        specCmd.addSimpleElement('Path', 'powershell.exe -WindowStyle "Normal" -ExecutionPolicy "Unrestricted" -NoProfile -File "' + context.specializeFile + '"');
      }
    }

    // 5. pass="auditSystem"
    var auditSystemSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'auditSystem' }));

    // 6. pass="auditUser"
    var auditUserSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'auditUser' }));

    // 7. pass="oobeSystem"
    var oobeSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'oobeSystem' }));
    if (context.langMode === 'Unattended') {
      var oobeIntl = oobeSettingsElem.addChild(new XmlNode('component', {
        'name': 'Microsoft-Windows-International-Core',
        'processorArchitecture': context.arch,
        'publicKeyToken': '31bf3856ad364e35',
        'language': 'neutral',
        'versionScope': 'nonSxS'
      }));

      var inputLocStr = context.keyboard;
      if (context.keyboard.indexOf('{') === -1 && context.keyboard.length === 8) {
        var lcidPrefix = context.keyboard.substring(4);
        inputLocStr = lcidPrefix + ':' + context.keyboard;
      }
      oobeIntl.addSimpleElement('InputLocale', inputLocStr);
      oobeIntl.addSimpleElement('SystemLocale', context.locale);
      oobeIntl.addSimpleElement('UILanguage', context.uiLang);
      oobeIntl.addSimpleElement('UserLocale', context.locale);
    }

    var oobeShell = oobeSettingsElem.addChild(new XmlNode('component', {
      'name': 'Microsoft-Windows-Shell-Setup',
      'processorArchitecture': context.arch,
      'publicKeyToken': '31bf3856ad364e35',
      'language': 'neutral',
      'versionScope': 'nonSxS'
    }));

    if (context.userAccountMode === 'Unattended' && context.accounts.length > 0) {
      var userAccounts = oobeShell.addChild(new XmlNode('UserAccounts'));
      var localAccounts = userAccounts.addChild(new XmlNode('LocalAccounts'));
      for (var a = 0; a < context.accounts.length; a++) {
        var acc = context.accounts[a];
        var locAcc = localAccounts.addChild(new XmlNode('LocalAccount', { 'wcm:action': 'add' }));
        locAcc.addSimpleElement('Name', acc.name);
        locAcc.addSimpleElement('DisplayName', acc.displayName);
        locAcc.addSimpleElement('Group', acc.group);
        var pwElem = locAcc.addChild(new XmlNode('Password'));
        var pwVal = acc.password;
        if (context.obscurePasswords) {
          var encStr = '';
          for (var c = 0; c < (pwVal + 'Password').length; c++) {
            var code = (pwVal + 'Password').charCodeAt(c);
            encStr += String.fromCharCode(code & 0xff, (code >> 8) & 0xff);
          }
          pwVal = btoa(encStr);
        }
        pwElem.addSimpleElement('Value', pwVal);
        pwElem.addSimpleElement('PlainText', context.obscurePasswords ? 'false' : 'true');
      }

      if (context.autoLogonMode !== 'None') {
        var autoLogonElem = oobeShell.addChild(new XmlNode('AutoLogon'));
        var firstAdmin = context.accounts.find(function (acc) { return acc.group === 'Administrators'; }) || context.accounts[0];
        autoLogonElem.addSimpleElement('Username', firstAdmin.name);
        autoLogonElem.addSimpleElement('Enabled', 'true');
        autoLogonElem.addSimpleElement('LogonCount', '1');
        var alPwElem = autoLogonElem.addChild(new XmlNode('Password'));
        var alPwVal = firstAdmin.password;
        if (context.obscurePasswords) {
          var encStrAl = '';
          for (var c2 = 0; c2 < (alPwVal + 'Password').length; c2++) {
            var code2 = (alPwVal + 'Password').charCodeAt(c2);
            encStrAl += String.fromCharCode(code2 & 0xff, (code2 >> 8) & 0xff);
          }
          alPwVal = btoa(encStrAl);
        }
        alPwElem.addSimpleElement('Value', alPwVal);
        alPwElem.addSimpleElement('PlainText', context.obscurePasswords ? 'false' : 'true');
      }
    }

    var oobeSub = oobeShell.addChild(new XmlNode('OOBE'));
    if (context.expressSettings === 'DisableAll') {
      oobeSub.addSimpleElement('ProtectYourPC', '3');
    } else if (context.expressSettings === 'EnableAll') {
      oobeSub.addSimpleElement('ProtectYourPC', '1');
    }
    oobeSub.addSimpleElement('HideEULAPage', 'true');
    oobeSub.addSimpleElement('HideWirelessSetupInOOBE', 'false');
    oobeSub.addSimpleElement('HideOnlineAccountScreens', 'false');

    if (context.firstLogonFile) {
      var firstLogonCommands = oobeShell.addChild(new XmlNode('FirstLogonCommands'));
      var syncCmdOobe = firstLogonCommands.addChild(new XmlNode('SynchronousCommand', { 'wcm:action': 'add' }));
      syncCmdOobe.addSimpleElement('Order', '1');
      syncCmdOobe.addSimpleElement('CommandLine', 'powershell.exe -WindowStyle "Normal" -ExecutionPolicy "Unrestricted" -NoProfile -File "' + context.firstLogonFile + '"');
    }

    var passSettings = {
      offlineServicing: offlineServicingSettingsElem,
      windowsPE: peSettingsElem,
      generalize: generalizeSettingsElem,
      specialize: specSettingsElem,
      auditSystem: auditSystemSettingsElem,
      auditUser: auditUserSettingsElem,
      oobeSystem: oobeSettingsElem
    };
    componentsMod.applyToPasses(passSettings);

    // 8. Extensions
    if (context.hasExtractScript || context.embeddedFiles.length > 0) {
      var extensionsElem = root.addChild(new XmlNode('Extensions', {
        'xmlns': 'https://schneegans.de/windows/unattend-generator/'
      }));

      var buildElem = extensionsElem.addChild(new XmlNode('Build'));
      var commitElem = buildElem.addChild(new XmlNode('Commit'));
      var urlBase = (typeof COMMIT_URL_BASE !== 'undefined' ? COMMIT_URL_BASE : 'https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP/commit/');
      commitElem.addSimpleElement('Hash', context.commitHash);
      commitElem.addSimpleElement('GitHubUrl', urlBase + context.commitHash);

      if (context.hasExtractScript) {
        var extractScriptElem = extensionsElem.addChild(new XmlNode('ExtractScript'));
        extractScriptElem.addChild(new XmlNode(EXTRACT_SCRIPTS_PS1, null, null, true));
      }

      for (var f = 0; f < context.embeddedFiles.length; f++) {
        var fileElem = extensionsElem.addChild(new XmlNode('File', { 'path': context.embeddedFiles[f].path }));
        fileElem.addChild(new XmlNode(context.embeddedFiles[f].content, null, null, true));
      }
    }

    // Serialize to XML string with CRLF and Tabs
    var queryString = '';
    if (formData && typeof formData.entries === 'function') {
      var qParams = [];
      var it = formData.entries();
      var entry = it.next();
      while (!entry.done) {
        var k = entry.value[0];
        var v = entry.value[1];
        var encK = encodeURIComponent(k).replace(/%20/g, '+').replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); });
        var encV = encodeURIComponent(v).replace(/%20/g, '+').replace(/[!'()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16).toUpperCase(); });
        qParams.push(encK + '=' + encV);
        entry = it.next();
      }
      queryString = qParams.join('&');
    }

    var xmlHeader = '<?xml version="1.0" encoding="utf-8"?>\r\n';
    var comment = queryString ? ('\t<!--https://schneegans.de/windows/unattend-generator/?' + queryString + '-->\r\n') : '';

    var serializedRoot = root.serialize(0);
    // Insert comment after <unattend ...>
    var rootOpenEnd = serializedRoot.indexOf('>\r\n');
    if (rootOpenEnd !== -1 && comment) {
      serializedRoot = serializedRoot.substring(0, rootOpenEnd + 3) + comment + serializedRoot.substring(rootOpenEnd + 3);
    }

    return xmlHeader + serializedRoot;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generateAutounattendXml: generateAutounattendXml
  };
}
