/**
 * unattend-generator Client Engine & Serverless Connector
 * 
 * High-precision standalone XML & ISO generator fully compatible with original schneegans unattend-generator
 */
(function (global) {
  'use strict';

  function getConfig() {
    var config = Object.assign({
      mode: 'client',
      serverEndpoint: '',
      allowUrlOverride: true
    }, (typeof window !== 'undefined' && window.UNATTEND_CONFIG) || {});

    if (config.allowUrlOverride && typeof window !== 'undefined' && window.location) {
      var params = new URLSearchParams(window.location.search);
      var engineParam = params.get('engine');
      var apiParam = params.get('api');
      if (engineParam === 'client' || engineParam === 'server') {
        config.mode = engineParam;
      }
      if (apiParam) {
        config.serverEndpoint = apiParam.replace(/\/+$/, '');
      }
    }
    return config;
  }

  // ISO 9660 image creator
  function createIsoBlob(filename, fileContentStr) {
    var SECTOR_SIZE = 2048;
    var encoder = new TextEncoder();
    var fileBytes = encoder.encode(fileContentStr);
    var fileSectors = Math.ceil(fileBytes.length / SECTOR_SIZE) || 1;
    var totalSectors = 16 + 1 + 1 + fileSectors + 1;
    var buffer = new Uint8Array(totalSectors * SECTOR_SIZE);

    var pvdOffset = 16 * SECTOR_SIZE;
    buffer[pvdOffset + 0] = 1;
    buffer.set(encoder.encode('CD001'), pvdOffset + 1);
    buffer[pvdOffset + 6] = 1;
    buffer.set(encoder.encode('WINDOWS                         '.substring(0, 32)), pvdOffset + 8);
    buffer.set(encoder.encode('UNATTEND                        '.substring(0, 32)), pvdOffset + 40);

    var rootDirOffset = pvdOffset + 156;
    buffer[rootDirOffset + 0] = 34;
    buffer[rootDirOffset + 2] = 18;
    buffer[rootDirOffset + 6] = 18;
    buffer[rootDirOffset + 10] = 2048 & 0xff;
    buffer[rootDirOffset + 11] = (2048 >> 8) & 0xff;
    buffer[rootDirOffset + 25] = 2;

    var termOffset = 17 * SECTOR_SIZE;
    buffer[termOffset + 0] = 255;
    buffer.set(encoder.encode('CD001'), termOffset + 1);
    buffer[termOffset + 6] = 1;

    var fileSector = 19;
    buffer.set(fileBytes, fileSector * SECTOR_SIZE);

    var ptr = 18 * SECTOR_SIZE;
    buffer[ptr + 0] = 34; buffer[ptr + 2] = 18; buffer[ptr + 10] = 2048 & 0xff; buffer[ptr + 25] = 2; buffer[ptr + 32] = 1; buffer[ptr + 33] = 0;
    ptr += 34;
    buffer[ptr + 0] = 34; buffer[ptr + 2] = 18; buffer[ptr + 10] = 2048 & 0xff; buffer[ptr + 25] = 2; buffer[ptr + 32] = 1; buffer[ptr + 33] = 1;
    ptr += 34;

    var isoName = (filename + ';1').toUpperCase();
    var recLen = 33 + isoName.length + (isoName.length % 2 === 0 ? 1 : 0);
    buffer[ptr + 0] = recLen;
    buffer[ptr + 2] = fileSector & 0xff;
    buffer[ptr + 3] = (fileSector >> 8) & 0xff;
    buffer[ptr + 10] = fileBytes.length & 0xff;
    buffer[ptr + 11] = (fileBytes.length >> 8) & 0xff;
    buffer[ptr + 25] = 0;
    buffer[ptr + 32] = isoName.length;
    buffer.set(encoder.encode(isoName), ptr + 33);

    return new Blob([buffer], { type: 'application/x-iso9660-image' });
  }

  // XmlWriter formatting helpers
  function escapeXmlText(text) {
    if (text == null) return '';
    var str = String(text);
    var res = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c === 38) { // &
        res += '&amp;';
      } else if (c === 60) { // <
        res += '&lt;';
      } else if (c === 62) { // >
        res += '&gt;';
      } else if (c > 127) {
        // Non-ASCII character -> numeric entity for ASCII-safe XML
        res += '&#' + 'x' + c.toString(16).toUpperCase() + ';';
      } else {
        res += str.charAt(i);
      }
    }
    return res;
  }

  function escapeXmlAttr(text) {
    if (text == null) return '';
    var str = String(text);
    var res = '';
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c === 38) {
        res += '&amp;';
      } else if (c === 60) {
        res += '&lt;';
      } else if (c === 62) {
        res += '&gt;';
      } else if (c === 34) {
        res += '&quot;';
      } else if (c === 39) {
        res += '&apos;';
      } else if (c > 127) {
        res += '&#' + 'x' + c.toString(16).toUpperCase() + ';';
      } else {
        res += str.charAt(i);
      }
    }
    return res;
  }

  // XML Node Data Structure
  function XmlNode(name, attrs, children, isText) {
    this.name = name || '';
    this.attrs = attrs || {};
    this.children = children || [];
    this.isText = !!isText;
    this.textValue = isText ? (name || '') : '';
  }

  XmlNode.prototype.addChild = function (child) {
    this.children.push(child);
    return child;
  };

  XmlNode.prototype.addSimpleElement = function (name, text) {
    var elem = new XmlNode(name);
    elem.addChild(new XmlNode(text != null ? String(text) : '', null, null, true));
    this.children.push(elem);
    return elem;
  };

  XmlNode.prototype.find = function (name) {
    for (var i = 0; i < this.children.length; i++) {
      if (!this.children[i].isText && this.children[i].name === name) {
        return this.children[i];
      }
    }
    return null;
  };

  XmlNode.prototype.serialize = function (depth) {
    var indent = '';
    for (var i = 0; i < depth; i++) {
      indent += '\t';
    }

    if (this.isText) {
      return escapeXmlText(this.textValue);
    }

    var attrStr = '';
    for (var key in this.attrs) {
      if (Object.prototype.hasOwnProperty.call(this.attrs, key)) {
        attrStr += ' ' + key + '="' + escapeXmlAttr(this.attrs[key]) + '"';
      }
    }

    if (this.children.length === 0) {
      return indent + '<' + this.name + attrStr + '></' + this.name + '>';
    }

    if (this.children.length === 1 && this.children[0].isText) {
      var txt = this.children[0].textValue;
      if (this.name !== 'File' && this.name !== 'ExtractScript' && txt.indexOf('\n') === -1) {
        return indent + '<' + this.name + attrStr + '>' + escapeXmlText(txt) + '</' + this.name + '>';
      } else {
        var cleanTxt = txt.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
        var lines = cleanTxt ? cleanTxt.split('\n') : [];
        var res = indent + '<' + this.name + attrStr + '>\r\n';
        for (var j = 0; j < lines.length; j++) {
          res += escapeXmlText(lines[j]) + '\r\n';
        }
        res += indent + '</' + this.name + '>';
        return res;
      }
    }

    var result = indent + '<' + this.name + attrStr + '>\r\n';
    for (var k = 0; k < this.children.length; k++) {
      var childRes = this.children[k].serialize(depth + 1);
      if (childRes.length > 0) {
        result += childRes + '\r\n';
      }
    }
    result += indent + '</' + this.name + '>';
    return result;
  };

  // PowerShell sequence builder matching C# PowerShellSequence
  function PowerShellSequence(activity, logFile) {
    this.activity = activity;
    this.logFile = logFile;
    this.commands = [];
    this.needsExplorerRestart = false;
  }

  PowerShellSequence.prototype.append = function (cmd) {
    if (cmd) {
      this.commands.push(cmd);
    }
  };

  PowerShellSequence.prototype.invokeFile = function (file) {
    this.append("& '" + file + "';");
  };

  PowerShellSequence.prototype.restartExplorer = function () {
    this.needsExplorerRestart = true;
  };

  PowerShellSequence.prototype.isEmpty = function () {
    return this.commands.length === 0 && !this.needsExplorerRestart;
  };

  PowerShellSequence.prototype.getScript = function () {
    var lines = ['$scripts = @('];
    for (var i = 0; i < this.commands.length; i++) {
      lines.push('\t{');
      var cmdLines = this.commands[i].replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      for (var j = 0; j < cmdLines.length; j++) {
        lines.push('\t\t' + cmdLines[j]);
      }
      lines.push('\t};');
    }
    if (this.needsExplorerRestart) {
      lines.push('\t{');
      lines.push("\t\tGet-Process -Name 'explorer' -ErrorAction 'SilentlyContinue' | Where-Object -FilterScript {");
      lines.push("\t\t\t$_.SessionId -eq ( Get-Process -Id $PID ).SessionId;");
      lines.push("\t\t} | Stop-Process -Force;");
      lines.push('\t};');
    }
    lines.push(');');
    lines.push('');
    lines.push('& {');
    lines.push('  [float] $complete = 0;');
    lines.push('  [float] $increment = 100 / $scripts.Count;');
    lines.push('  foreach( $script in $scripts ) {');
    lines.push("    Write-Progress -Id 0 -Activity '" + this.activity + " Do not close this window.' -PercentComplete $complete;");
    lines.push("    '*** Will now execute command «{0}».' -f $(");
    lines.push("      $script.ToString().Trim() -replace '\\s+', ' ' -replace '^(.{99})(.+)$', '$1…';");
    lines.push('    );');
    lines.push('    $start = [datetime]::Now;');
    lines.push('    & $script;');
    lines.push("    '*** Finished executing command after {0:0} ms.' -f [datetime]::Now.Subtract( $start ).TotalMilliseconds;");
    lines.push('    "`r`n" * 3;');
    lines.push('    $complete += $increment;');
    lines.push('  }');
    lines.push('} *>&1 | Out-String -Width 1KB -Stream >> "' + this.logFile + '";');

    return lines.join('\r\n');
  };

  var EXTRACT_SCRIPTS_PS1 = [
    'param(',
    '    [xml] $Document',
    ');',
    '',
    'foreach( $file in $Document.unattend.Extensions.File ) {',
    "    $path = [System.Environment]::ExpandEnvironmentVariables( $file.GetAttribute( 'path' ) );",
    "    mkdir -Path( $path | Split-Path -Parent ) -ErrorAction 'SilentlyContinue';",
    '    $encoding = switch( [System.IO.Path]::GetExtension( $path ) ) {',
    "        { $_ -in '.ps1', '.xml' } { [System.Text.Encoding]::UTF8; }",
    "        { $_ -in '.reg', '.vbs', '.js' } { [System.Text.UnicodeEncoding]::new( $false, $true ); }",
    '        default { [System.Text.Encoding]::Default; }',
    '    };',
    '    $bytes = $encoding.GetPreamble() + $encoding.GetBytes( $file.InnerText.Trim() );',
    '    [System.IO.File]::WriteAllBytes( $path, $bytes );',
    '}'
  ].join('\r\n');

  var SET_COMPUTER_NAME_PS1 = [
    "$ErrorActionPreference = 'Stop';",
    "Set-StrictMode -Version 'Latest';",
    '& {',
    "\t$newName = ( Get-Content -LiteralPath 'C:\\Windows\\Setup\\Scripts\\ComputerName.txt' -Raw ).Trim();",
    '\tif( [string]::IsNullOrWhitespace( $newName ) ) {',
    '\t\tthrow "No computer name was provided.";',
    '\t}',
    '',
    '\t$keys = @(',
    '\t\t@{',
    "\t\t\tLiteralPath = 'Registry::HKLM\\SYSTEM\\CurrentControlSet\\Control\\ComputerName\\ComputerName';",
    "\t\t\tName = 'ComputerName';",
    '\t\t};',
    '\t\t@{',
    "\t\t\tLiteralPath = 'Registry::HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters';",
    "\t\t\tName = 'Hostname';",
    '\t\t};',
    '\t\t@{',
    "\t\t\tLiteralPath = 'Registry::HKLM\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters';",
    "\t\t\tName = 'NV Hostname';",
    '\t\t};',
    '\t);',
    '',
    '\twhile( $true ) {',
    '\t\tforeach( $key in $keys ) {',
    "\t\t\tSet-ItemProperty @key -Type 'String' -Value $newName;",
    '\t\t}',
    '\t\tStart-Sleep -Milliseconds 50;',
    '\t}',
    "} *>&1 | Out-String -Width 1KB -Stream >> 'C:\\Windows\\Setup\\Scripts\\SetComputerName.log';"
  ].join('\r\n');

  // Generate full autounattend.xml from FormData or query string
  function generateAutounattendXml(formData) {
    if (!formData && typeof document !== 'undefined') {
      var defaultForm = getMainForm();
      if (defaultForm) formData = new FormData(defaultForm);
    } else if (formData && typeof HTMLFormElement !== 'undefined' && formData instanceof HTMLFormElement) {
      formData = new FormData(formData);
    } else if (typeof formData === 'string') {
      formData = new URLSearchParams(formData.indexOf('?') !== -1 ? formData.split('?')[1] : formData);
    }

    var getVal = function (name, def) {
      if (!formData || typeof formData.get !== 'function') return def;
      var val = formData.get(name);
      return (val !== null && val !== undefined && val !== '') ? val : def;
    };
    var getBool = function (name, def) {
      if (!formData || typeof formData.get !== 'function') return !!def;
      var val = formData.get(name);
      if (val === null || val === undefined) return !!def;
      return val === 'true' || val === 'on' || val === '1';
    };

    var commitHash = '5f9295fabfa7d5526526472f6fdd3fd20b5b27c3';

    // Script sequences
    var specializeScript = new PowerShellSequence('Running scripts to customize your Windows installation.', 'C:\\Windows\\Setup\\Scripts\\Specialize.log');
    var firstLogonScript = new PowerShellSequence('Running scripts to finalize your Windows installation.', 'C:\\Windows\\Setup\\Scripts\\FirstLogon.log');
    var userOnceScript = new PowerShellSequence('Running scripts to configure this user account.', '$env:TEMP\\UserOnce.log');
    var defaultUserScript = new PowerShellSequence('Running scripts to modify default user registry hive.', 'C:\\Windows\\Setup\\Scripts\\DefaultUser.log');

    var embeddedFiles = [];
    var hasExtractScript = false;

    function embedTextFile(name, content) {
      var path = name.indexOf('\\') !== -1 ? name : 'C:\\Windows\\Setup\\Scripts\\' + name;
      hasExtractScript = true;
      embeddedFiles.push({ path: path, content: content });
      return path;
    }

    // Architecture
    var arch = getVal('ProcessorArchitecture', 'amd64');

    // Language settings
    var langMode = getVal('LanguageMode', 'Unattended');
    var uiLang = getVal('UILanguage', 'en-US');
    var locale = getVal('Locale', 'en-US');
    var keyboard = getVal('Keyboard', '00000409');
    var geoLoc = getVal('GeoLocation', '244');
    var isJapaneseKeyboard = (keyboard === '00000411' || keyboard.indexOf('0411:') === 0 || locale === 'ja-JP' || uiLang === 'ja-JP');

    // PE Settings
    var peMode = getVal('PEMode', 'Default');
    var winEditionMode = getVal('WindowsEditionMode', 'Interactive');
    var productKeyVal = getVal('ProductKey', '00000-00000-00000-00000-00000');
    var bypassRequirements = getBool('BypassRequirementsCheck', false);
    var bypassNetwork = getBool('BypassNetworkCheck', false);
    var useConfigurationSet = getBool('UseConfigurationSet', false);

    // Accounts
    var userAccountMode = getVal('UserAccountMode', 'Unattended');
    var autoLogonMode = getVal('AutoLogonMode', 'Own');
    var obscurePasswords = getBool('ObscurePasswords', false);
    var accounts = [];
    for (var i = 0; i < 10; i++) {
      var accName = formData.get('AccountName' + i);
      if (accName) {
        accounts.push({
          name: accName,
          displayName: getVal('AccountDisplayName' + i, ''),
          group: getVal('AccountGroup' + i, 'Administrators'),
          password: getVal('AccountPassword' + i, '')
        });
      }
    }
    if (accounts.length === 0 && (userAccountMode === 'Unattended' || getBool('LocalUser', false))) {
      accounts.push({ name: 'Admin', displayName: '', group: 'Administrators', password: '' });
      accounts.push({ name: 'User', displayName: '', group: 'Users', password: '' });
    }

    // Computer Name (ComputerNameModifier before Password/Lockout in C#)
    var compNameMode = getVal('ComputerNameMode', 'Random');
    var customCompName = getVal('ComputerName', '');
    var compNameScript = getVal('ComputerNameScript', '');
    var specCompName = null;
    if (compNameMode === 'Custom' && customCompName) {
      specCompName = customCompName;
    } else if (compNameMode === 'Script' && compNameScript) {
      specCompName = 'TEMPNAME';
      var getterFile = embedTextFile('GetComputerName.ps1', compNameScript);
      var setterFile = embedTextFile('SetComputerName.ps1', SET_COMPUTER_NAME_PS1);
      specializeScript.append([
        "[string] $newName = & '" + getterFile + "';",
        "$newName > 'C:\\Windows\\Setup\\Scripts\\ComputerName.txt';",
        '"Will set the computer name to \'${newName}\'.";',
        'Start-Process -FilePath ( Get-Process -Id $PID ).Path -ArgumentList \'-ExecutionPolicy "Unrestricted" -NoProfile -File "' + setterFile + '"\' -WindowStyle \'Hidden\';',
        'Start-Sleep -Seconds 10;'
      ].join('\r\n'));
    }

    // Password & Lockout Policies
    var pwExpMode = getVal('PasswordExpirationMode', 'Unlimited');
    if (pwExpMode === 'Unlimited') {
      specializeScript.append('net.exe accounts /maxpwage:UNLIMITED;');
    } else if (pwExpMode === 'Custom') {
      var maxAge = getVal('PasswordExpirationDays', '42');
      specializeScript.append('net.exe accounts /maxpwage:' + maxAge + ';');
    }

    var lockoutMode = getVal('LockoutMode', 'Default');
    if (lockoutMode === 'Disabled') {
      specializeScript.append('net.exe accounts /lockoutthreshold:0;');
    } else if (lockoutMode === 'Custom') {
      var thresh = getVal('LockoutThreshold', '5');
      var dur = getVal('LockoutDuration', '30');
      var win = getVal('LockoutWindow', '30');
      specializeScript.append('net.exe accounts /lockoutthreshold:' + thresh + ' /lockoutduration:' + dur + ' /lockoutwindow:' + win + ';');
    }

    // TimeZone
    var tzMode = getVal('TimeZoneMode', 'Implicit');
    var tzId = getVal('TimeZone', '');

    // Express Settings
    var expressSettings = getVal('ExpressSettings', 'DisableAll');

    // AutoLogon script (UsersModifier)
    if (userAccountMode === 'Unattended' && autoLogonMode !== 'None') {
      firstLogonScript.append("Set-ItemProperty -LiteralPath 'Registry::HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon' -Name 'AutoLogonCount' -Type 'DWord' -Force -Value 0;");
    }

    // Optimizations & Registry
    if (getBool('ClassicContextMenu', false)) {
      userOnceScript.append('reg.exe add "HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32" /ve /f;');
      userOnceScript.restartExplorer();
    }
    if (getBool('ShowFileExtensions', false) || getBool('HideFileExt', false)) {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "HideFileExt" /t REG_DWORD /d 0 /f;');
    }
    if (getBool('DisableAppSuggestions', false)) {
      defaultUserScript.append([
        '$names = @(',
        "  'ContentDeliveryAllowed';",
        "  'FeatureManagementEnabled';",
        "  'OEMPreInstalledAppsEnabled';",
        "  'PreInstalledAppsEnabled';",
        "  'PreInstalledAppsEverEnabled';",
        "  'SilentInstalledAppsEnabled';",
        "  'SoftLandingEnabled';",
        "  'SubscribedContent-310093Enabled';",
        "  'SubscribedContent-338387Enabled';",
        "  'SubscribedContent-338388Enabled';",
        "  'SubscribedContent-338389Enabled';",
        "  'SubscribedContent-353698Enabled';",
        "  'SystemPaneSuggestionsEnabled';",
        ');',
        'foreach( $name in $names ) {',
        '  reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v $name /t REG_DWORD /d 0 /f;',
        '}'
      ].join('\r\n'));
      specializeScript.append(
        'reg.exe add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent" /v "DisableWindowsConsumerFeatures" /t REG_DWORD /d 1 /f;'
      );
    }
    var hideFiles = getVal('HideFiles', 'Hidden');
    if (hideFiles === 'None') {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "Hidden" /t REG_DWORD /d 1 /f;');
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "ShowSuperHidden" /t REG_DWORD /d 1 /f;');
    } else if (hideFiles === 'HiddenSystem') {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "Hidden" /t REG_DWORD /d 1 /f;');
    }
    if (getBool('LeftTaskbar', false)) {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAl /t REG_DWORD /d 0 /f;');
    }
    if (getBool('HideTaskViewButton', false)) {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowTaskViewButton /t REG_DWORD /d 0 /f;');
    }
    if (getBool('DisableFastStartup', false)) {
      specializeScript.append('reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f;');
    }
    if (getBool('DisableWidgets', false)) {
      specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Dsh" /v AllowNewsAndInterests /t REG_DWORD /d 0 /f;');
    }
    if (getBool('DisableSmartScreen', false)) {
      specializeScript.append([
        'reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer" /v SmartScreenEnabled /t REG_SZ /d "Off" /f;',
        'reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WTDS\\Components" /v ServiceEnabled /t REG_DWORD /d 0 /f;',
        'reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WTDS\\Components" /v NotifyMalicious /t REG_DWORD /d 0 /f;',
        'reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WTDS\\Components" /v NotifyPasswordReuse /t REG_DWORD /d 0 /f;',
        'reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WTDS\\Components" /v NotifyUnsafeApp /t REG_DWORD /d 0 /f;',
        'reg.exe add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows Defender Security Center\\Systray" /v HideSystray /t REG_DWORD /d 1 /f;'
      ].join('\r\n'));
      defaultUserScript.append([
        'reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Edge\\SmartScreenEnabled" /ve /t REG_DWORD /d 0 /f;',
        'reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Edge\\SmartScreenPuaEnabled" /ve /t REG_DWORD /d 0 /f;',
        'reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\AppHost" /v EnableWebContentEvaluation /t REG_DWORD /d 0 /f;',
        'reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\AppHost" /v PreventOverride /t REG_DWORD /d 0 /f;'
      ].join('\r\n'));
    }
    if (getBool('DisableUac', false)) {
      specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v EnableLUA /t REG_DWORD /d 0 /f');
    }
    if (getBool('EnableLongPaths', false)) {
      specializeScript.append('reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f');
    }
    if (getBool('EnableRemoteDesktop', false)) {
      specializeScript.append([
        'netsh.exe advfirewall firewall set rule group="@FirewallAPI.dll,-28752" new enable=Yes;',
        'reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f;'
      ].join('\r\n'));
    }
    if (getBool('PreventDeviceEncryption', false)) {
      specializeScript.append('reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\BitLocker" /v "PreventDeviceEncryption" /t REG_DWORD /d 1 /f;');
    }

    if (getBool('MakeEdgeUninstallable', false)) {
      embedTextFile('MakeEdgeUninstallable.ps1', [
        'try {',
        '	$params = @{',
        "		LiteralPath = 'C:\\Windows\\System32\\IntegratedServicesRegionPolicySet.json';",
        "		Encoding = 'Utf8';",
        '	};',
        '	$o = Get-Content @params | ConvertFrom-Json;',
        '	$o.policies | ForEach-Object -Process {',
        "		if( $_.guid -eq '{1bca278a-5d11-4acf-ad2f-f9ab6d7f93a6}' ) {",
        "			$_.defaultState = 'enabled';",
        '		}',
        '	};',
        '	$o | ConvertTo-Json -Depth 9 | Out-File @params;',
        '} catch {',
        '	$_;',
        '}'
      ].join('\r\n'));
      specializeScript.invokeFile('C:\\Windows\\Setup\\Scripts\\MakeEdgeUninstallable.ps1');
    }
    if (getBool('VBoxGuestAdditions', false)) {
      embedTextFile('VBoxGuestAdditions.ps1', [
        "foreach( $letter in 'DEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray() ) {",
        '	$exe = "${letter}:\\VBoxWindowsAdditions.exe";',
        '	if( Test-Path -LiteralPath $exe ) {',
        '		$certs = "${letter}:\\cert";',
        '		Start-Process -FilePath "${certs}\\VBoxCertUtil.exe" -ArgumentList "add-trusted-publisher ${certs}\\vbox*.cer", "--root ${certs}\\vbox*.cer"  -Wait;',
        "		Start-Process -FilePath $exe -ArgumentList '/with_wddm', '/S' -Wait;",
        '		return;',
        '	}',
        '}',
        "'VBoxGuestAdditions.iso is not attached to this VM.';"
      ].join('\r\n'));
      firstLogonScript.invokeFile('C:\\Windows\\Setup\\Scripts\\VBoxGuestAdditions.ps1');
    }
    if (getBool('VMwareTools', false)) {
      embedTextFile('VMwareTools.ps1', [
        "foreach( $letter in 'DEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray() ) {",
        '	$exe = "${letter}:\\setup.exe";',
        "	if( ( Get-Item -LiteralPath $exe -ErrorAction 'SilentlyContinue' | Select-Object -ExpandProperty 'VersionInfo' | Select-Object -ExpandProperty 'ProductName' ) -eq 'VMware Tools' ) {",
        "		Start-Process -FilePath $exe -ArgumentList '/s /v /qn REBOOT=R' -Wait;",
        '		return;',
        '	}',
        '}',
        "'VMware Tools image (windows.iso) is not attached to this VM.';"
      ].join('\r\n'));
      firstLogonScript.invokeFile('C:\\Windows\\Setup\\Scripts\\VMwareTools.ps1');
    }
    if (getBool('VirtIoGuestTools', false)) {
      embedTextFile('VirtIoGuestTools.ps1', [
        "foreach( $letter in 'DEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray() ) {",
        '	$exe = "${letter}:\\virtio-win-guest-tools.exe";',
        '	if( Test-Path -LiteralPath $exe ) {',
        "		Start-Process -FilePath $exe -ArgumentList '/passive', '/norestart' -Wait;",
        '		return;',
        '	}',
        '}',
        "'VirtIO Guest Tools image (virtio-win-*.iso) is not attached to this VM.';"
      ].join('\r\n'));
      firstLogonScript.invokeFile('C:\\Windows\\Setup\\Scripts\\VirtIoGuestTools.ps1');
    }
    // Bloatware removal
    var bloatwareMap = [
      { key: 'Remove3DViewer', patterns: ['*Microsoft.Microsoft3DViewer*'] },
      { key: 'RemoveBingSearch', patterns: ['*Microsoft.BingSearch*'] },
      { key: 'RemoveCalculator', patterns: ['*Microsoft.WindowsCalculator*'] },
      { key: 'RemoveCamera', patterns: ['*Microsoft.WindowsCamera*'] },
      { key: 'RemoveClipchamp', patterns: ['*Clipchamp.Clipchamp*'] },
      { key: 'RemoveClock', patterns: ['*Microsoft.WindowsAlarms*'] },
      { key: 'RemoveCopilot', patterns: ['*Microsoft.Copilot*'] },
      { key: 'RemoveCortana', patterns: ['*Microsoft.549981C3F5F10*'] },
      { key: 'RemoveDevHome', patterns: ['*Microsoft.Windows.DevHome*'] },
      { key: 'RemoveFamily', patterns: ['*MicrosoftCorporationII.MicrosoftFamily*'] },
      { key: 'RemoveFeedbackHub', patterns: ['*Microsoft.WindowsFeedbackHub*'] },
      { key: 'RemoveGameAssist', patterns: ['*Microsoft.Edge.GameAssist*'] },
      { key: 'RemoveGetHelp', patterns: ['*Microsoft.GetHelp*'] },
      { key: 'RemoveMailCalendar', patterns: ['*microsoft.windowscommunicationsapps*'] },
      { key: 'RemoveMaps', patterns: ['*Microsoft.WindowsMaps*'] },
      { key: 'RemoveMixedReality', patterns: ['*Microsoft.MixedReality.Portal*'] },
      { key: 'RemoveNews', patterns: ['*Microsoft.BingNews*'] },
      { key: 'RemoveOffice365', patterns: ['*Microsoft.MicrosoftOfficeHub*'] },
      { key: 'RemoveOneDrive', patterns: ['*OneDrive*'] },
      { key: 'RemoveOneNote', patterns: ['*Microsoft.Office.OneNote*'] },
      { key: 'RemoveOutlook', patterns: ['*Microsoft.OutlookForWindows*'] },
      { key: 'RemovePaint', patterns: ['*Microsoft.Paint*'] },
      { key: 'RemovePeople', patterns: ['*Microsoft.People*'] },
      { key: 'RemovePhotos', patterns: ['*Microsoft.Windows.Photos*'] },
      { key: 'RemovePowerAutomate', patterns: ['*Microsoft.PowerAutomateDesktop*'] },
      { key: 'RemoveQuickAssist', patterns: ['*MicrosoftCorporationII.QuickAssist*'] },
      { key: 'RemoveSkype', patterns: ['*Microsoft.SkypeApp*'] },
      { key: 'RemoveSnippingTool', patterns: ['*Microsoft.ScreenSketch*', '*Microsoft.Windows.SnippingTool*'] },
      { key: 'RemoveSolitaire', patterns: ['*Microsoft.MicrosoftSolitaireCollection*'] },
      { key: 'RemoveStickyNotes', patterns: ['*Microsoft.MicrosoftStickyNotes*'] },
      { key: 'RemoveTeams', patterns: ['*MicrosoftTeams*', '*MSTeams*'] },
      { key: 'RemoveGetStarted', patterns: ['*Microsoft.Getstarted*'] },
      { key: 'RemoveToDo', patterns: ['*Microsoft.Todos*'] },
      { key: 'RemoveVoiceRecorder', patterns: ['*Microsoft.WindowsSoundRecorder*'] },
      { key: 'RemoveWallet', patterns: ['*Microsoft.Wallet*'] },
      { key: 'RemoveWeather', patterns: ['*Microsoft.BingWeather*'] },
      { key: 'RemoveWindowsTerminal', patterns: ['*Microsoft.WindowsTerminal*'] },
      { key: 'RemoveXboxApps', patterns: ['*Microsoft.Xbox*', '*Microsoft.GamingApp*'] },
      { key: 'RemoveYourPhone', patterns: ['*Microsoft.YourPhone*'] },
      { key: 'RemoveZuneMusic', patterns: ['*Microsoft.ZuneMusic*'] }
    ];

    var selectedBloatwarePatterns = [];
    bloatwareMap.forEach(function (item) {
      if (getBool(item.key, false)) {
        selectedBloatwarePatterns.push.apply(selectedBloatwarePatterns, item.patterns);
      }
    });

    if (selectedBloatwarePatterns.length > 0) {
      var removePkgLines = [
        '$patterns = @(' + selectedBloatwarePatterns.map(function (p) { return "'" + p + "'"; }).join(', ') + ');',
        'foreach( $pattern in $patterns ) {',
        '  Get-AppxProvisionedPackage -Online | Where-Object { $_.PackageName -like $pattern } | Remove-AppxProvisionedPackage -Online -AllUsers -ErrorAction SilentlyContinue;',
        '}'
      ];
      embedTextFile('RemovePackage.ps1', removePkgLines.join('\r\n'));
      specializeScript.invokeFile('C:\\Windows\\Setup\\Scripts\\RemovePackage.ps1');
    }

    if (getBool('RemoveCopilot', false)) {
      userOnceScript.append("Get-AppxPackage -Name 'Microsoft.Windows.Ai.Copilot.Provider' | Remove-AppxPackage;");
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f;');
    }
    if (getBool('RemoveXboxApps', false)) {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f;');
    }
    if (getBool('RemoveTeams', false)) {
      specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Communications" /v ConfigureChatAutoInstall /t REG_DWORD /d 0 /f;');
    }
    if (getBool('RemoveOneDrive', false)) {
      specializeScript.append([
        '@(',
        "  'C:\\Users\\Default\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\OneDrive.lnk';",
        "  'C:\\Windows\\System32\\OneDriveSetup.exe';",
        "  'C:\\Windows\\SysWOW64\\OneDriveSetup.exe';",
        ") | Where-Object -FilterScript { [System.IO.File]::Exists( $_ ); } | Remove-Item -Verbose -ErrorAction 'Continue';"
      ].join('\r\n'));
      defaultUserScript.append("Remove-ItemProperty -LiteralPath 'Registry::HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'OneDriveSetup' -Force -ErrorAction 'Continue';");
    }


    if (isJapaneseKeyboard) {
      specializeScript.append([
        "$regPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\i8042prt\\Parameters';",
        "if (!(Test-Path $regPath)) {",
        "    New-Item -Path $regPath -Force | Out-Null;",
        "}",
        "Set-ItemProperty -Path $regPath -Name 'LayerDriver JPN' -Value 'kbd106.dll' -Type String -Force;",
        "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardIdentifier' -Value 'PCAT_106KEY' -Type String -Force;",
        "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardSubtype' -Value 2 -Type DWord -Force;",
        "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardType' -Value 7 -Type DWord -Force;"
      ].join('\r\n'));

      firstLogonScript.append([
        "$regPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\i8042prt\\Parameters';",
        "if (!(Test-Path $regPath)) {",
        "    New-Item -Path $regPath -Force | Out-Null;",
        "}",
        "Set-ItemProperty -Path $regPath -Name 'LayerDriver JPN' -Value 'kbd106.dll' -Type String -Force;",
        "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardIdentifier' -Value 'PCAT_106KEY' -Type String -Force;",
        "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardSubtype' -Value 2 -Type DWord -Force;",
        "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardType' -Value 7 -Type DWord -Force;",
        "try {",
        "    $langList = New-WinUserLanguageList -Language 'ja-JP';",
        "    Set-WinUserLanguageList -LanguageList $langList -Force;",
        "    Copy-UserInternationalSettingsToSystem -WelcomeScreen $true -NewUser $true;",
        "} catch {}"
      ].join('\r\n'));
    }

    // RestartExplorer option & Custom Scripts (ScriptsModifier)
    if (getBool('RestartExplorer', false)) {
      userOnceScript.restartExplorer();
    }

    var scriptPhases = [
      {
        name: 'System',
        sequence: specializeScript,
        count: 4,
        defaultTypes: ['Cmd', 'Ps1', 'Reg', 'Vbs']
      },
      {
        name: 'DefaultUser',
        sequence: defaultUserScript,
        count: 3,
        defaultTypes: ['Reg', 'Cmd', 'Ps1']
      },
      {
        name: 'FirstLogon',
        sequence: firstLogonScript,
        count: 4,
        defaultTypes: ['Cmd', 'Ps1', 'Reg', 'Vbs']
      },
      {
        name: 'UserOnce',
        sequence: userOnceScript,
        count: 4,
        defaultTypes: ['Cmd', 'Ps1', 'Reg', 'Vbs']
      }
    ];

    var customScriptIndex = 0;
    for (var sp = 0; sp < scriptPhases.length; sp++) {
      var sPhase = scriptPhases[sp];
      for (var si = 0; si < sPhase.count; si++) {
        var sKey = sPhase.name + 'Script' + si;
        var tKey = sPhase.name + 'ScriptType' + si;
        var rContent = getVal(sKey, '');
        if (rContent && rContent.trim().length > 0) {
          var sContent = rContent.trim();
          var sType = getVal(tKey, sPhase.defaultTypes[si] || 'Cmd');

          customScriptIndex++;
          var sHexIndex = (customScriptIndex < 16 ? '0' : '') + customScriptIndex.toString(16).toLowerCase();
          var sFileName = 'unattend-' + sHexIndex + '.' + sType.toLowerCase();
          var sFilePath = 'C:\\Windows\\Setup\\Scripts\\' + sFileName;

          if (sType.toLowerCase() === 'reg') {
            var rPrefix = 'Windows Registry Editor Version 5.00';
            if (sContent.indexOf(rPrefix) !== 0) {
              sContent = rPrefix + '\r\n\r\n' + sContent;
            }
          }
          sContent = sContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');

          embedTextFile(sFileName, sContent);

          var sTypeLower = sType.toLowerCase();
          if (sTypeLower === 'ps1') {
            sPhase.sequence.invokeFile(sFilePath);
          } else if (sTypeLower === 'cmd') {
            sPhase.sequence.append(sFilePath + ';');
          } else if (sTypeLower === 'reg') {
            sPhase.sequence.append('reg.exe import "' + sFilePath + '";');
          } else if (sTypeLower === 'vbs') {
            sPhase.sequence.append('cscript.exe //E:vbscript "' + sFilePath + '";');
          } else if (sTypeLower === 'js') {
            sPhase.sequence.append('cscript.exe //E:jscript "' + sFilePath + '";');
          }
        }
      }
    }

    // KeepSensitiveFiles (DeleteModifier - runs after custom scripts, before finalization)
    var keepSensitiveFiles = getBool('KeepSensitiveFiles', false);
    if (!keepSensitiveFiles && userAccountMode === 'Unattended' && autoLogonMode !== 'None') {
      firstLogonScript.append([
        'Remove-Item -LiteralPath @(',
        "  'C:\\Windows\\Panther\\unattend.xml';",
        "  'C:\\Windows\\Panther\\unattend-original.xml';",
        "  'C:\\Windows\\Setup\\Scripts\\Wifi.xml';",
        ") -Force -ErrorAction 'SilentlyContinue' -Verbose;"
      ].join('\r\n'));
    }


    // Finalize PowerShell sequences into embedded files
    if (!userOnceScript.isEmpty()) {
      var userOnceFile = embedTextFile('UserOnce.ps1', userOnceScript.getScript());
      var cmdEscaped = ('powershell.exe -WindowStyle "Normal" -ExecutionPolicy "Unrestricted" -NoProfile -File "' + userOnceFile + '"').replace(/"/g, '\\"');
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce" /v "UnattendedSetup" /t REG_SZ /d "' + cmdEscaped + '" /f;');
    }
    if (!defaultUserScript.isEmpty()) {
      var defUserFile = embedTextFile('DefaultUser.ps1', defaultUserScript.getScript());
      specializeScript.append('reg.exe load "HKU\\DefaultUser" "C:\\Users\\Default\\NTUSER.DAT";');
      specializeScript.invokeFile(defUserFile);
      specializeScript.append('reg.exe unload "HKU\\DefaultUser";');
    }

    var specializeFile = null;
    if (!specializeScript.isEmpty()) {
      specializeFile = embedTextFile('Specialize.ps1', specializeScript.getScript());
    }
    var firstLogonFile = null;
    if (!firstLogonScript.isEmpty()) {
      firstLogonFile = embedTextFile('FirstLogon.ps1', firstLogonScript.getScript());
    }

    // Construct XML Hierarchy
    var root = new XmlNode('unattend', {
      'xmlns': 'urn:schemas-microsoft-com:unattend',
      'xmlns:wcm': 'http://schemas.microsoft.com/WMIConfig/2002/State'
    });

    // 1. pass="offlineServicing"
    root.addChild(new XmlNode('settings', { 'pass': 'offlineServicing' }));

    // 2. pass="windowsPE"
    var peSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'windowsPE' }));
    if (langMode === 'Unattended') {
      var peIntl = peSettingsElem.addChild(new XmlNode('component', {
        'name': 'Microsoft-Windows-International-Core-WinPE',
        'processorArchitecture': arch,
        'publicKeyToken': '31bf3856ad364e35',
        'language': 'neutral',
        'versionScope': 'nonSxS'
      }));
      if (isJapaneseKeyboard) {
        var peInputLocStr = keyboard;
        if (keyboard.indexOf('{') === -1 && keyboard.length === 8) {
          var peLcidPrefix = keyboard.substring(4);
          peInputLocStr = peLcidPrefix + ':' + keyboard;
        }
        peIntl.addSimpleElement('InputLocale', peInputLocStr);
        peIntl.addSimpleElement('SystemLocale', locale);
        peIntl.addSimpleElement('UILanguage', uiLang);
        peIntl.addSimpleElement('UserLocale', locale);
        peIntl.addSimpleElement('LayeredDriver', '1');
      } else {
        peIntl.addSimpleElement('UILanguage', uiLang);
      }
    }

    var winSetup = peSettingsElem.addChild(new XmlNode('component', {
      'name': 'Microsoft-Windows-Setup',
      'processorArchitecture': arch,
      'publicKeyToken': '31bf3856ad364e35',
      'language': 'neutral',
      'versionScope': 'nonSxS'
    }));

    if (bypassRequirements) {
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
    if (winEditionMode === 'Interactive') {
      prodKeyElem.addSimpleElement('Key', '00000-00000-00000-00000-00000');
      prodKeyElem.addSimpleElement('WillShowUI', 'Always');
    } else if (winEditionMode === 'Custom' && productKeyVal) {
      prodKeyElem.addSimpleElement('Key', productKeyVal);
      prodKeyElem.addSimpleElement('WillShowUI', 'OnError');
    } else if (winEditionMode === 'Firmware') {
      prodKeyElem.addSimpleElement('WillShowUI', 'Never');
    } else {
      prodKeyElem.addSimpleElement('Key', productKeyVal || '00000-00000-00000-00000-00000');
      prodKeyElem.addSimpleElement('WillShowUI', 'OnError');
    }
    userData.addSimpleElement('AcceptEula', 'true');
    winSetup.addSimpleElement('UseConfigurationSet', useConfigurationSet ? 'true' : 'false');

    // 3. pass="generalize"
    root.addChild(new XmlNode('settings', { 'pass': 'generalize' }));

    // 4. pass="specialize"
    var specSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'specialize' }));
    if (specCompName || (tzMode === 'Explicit' && tzId)) {
      var specShell = specSettingsElem.addChild(new XmlNode('component', {
        'name': 'Microsoft-Windows-Shell-Setup',
        'processorArchitecture': arch,
        'publicKeyToken': '31bf3856ad364e35',
        'language': 'neutral',
        'versionScope': 'nonSxS'
      }));
      if (specCompName) {
        specShell.addSimpleElement('ComputerName', specCompName);
      }
      if (tzMode === 'Explicit' && tzId) {
        specShell.addSimpleElement('TimeZone', tzId);
      }
    }

    if (hasExtractScript || specializeFile) {
      var specDeploy = specSettingsElem.addChild(new XmlNode('component', {
        'name': 'Microsoft-Windows-Deployment',
        'processorArchitecture': arch,
        'publicKeyToken': '31bf3856ad364e35',
        'language': 'neutral',
        'versionScope': 'nonSxS'
      }));
      var runSync = specDeploy.addChild(new XmlNode('RunSynchronous'));
      var orderNum = 1;
      if (hasExtractScript) {
        var extractCmd = runSync.addChild(new XmlNode('RunSynchronousCommand', { 'wcm:action': 'add' }));
        extractCmd.addSimpleElement('Order', String(orderNum++));
        extractCmd.addSimpleElement('Path', 'powershell.exe -WindowStyle "Normal" -NoProfile -Command "$xml = [xml]::new(); $xml.Load(\'C:\\Windows\\Panther\\unattend.xml\'); $sb = [scriptblock]::Create( $xml.unattend.Extensions.ExtractScript ); Invoke-Command -ScriptBlock $sb -ArgumentList $xml;"');
      }
      if (specializeFile) {
        var specCmd = runSync.addChild(new XmlNode('RunSynchronousCommand', { 'wcm:action': 'add' }));
        specCmd.addSimpleElement('Order', String(orderNum++));
        specCmd.addSimpleElement('Path', 'powershell.exe -WindowStyle "Normal" -ExecutionPolicy "Unrestricted" -NoProfile -File "' + specializeFile + '"');
      }
    }

    // 5. pass="auditSystem"
    root.addChild(new XmlNode('settings', { 'pass': 'auditSystem' }));

    // 6. pass="auditUser"
    root.addChild(new XmlNode('settings', { 'pass': 'auditUser' }));

    // 7. pass="oobeSystem"
    var oobeSettingsElem = root.addChild(new XmlNode('settings', { 'pass': 'oobeSystem' }));
    if (langMode === 'Unattended') {
      var oobeIntl = oobeSettingsElem.addChild(new XmlNode('component', {
        'name': 'Microsoft-Windows-International-Core',
        'processorArchitecture': arch,
        'publicKeyToken': '31bf3856ad364e35',
        'language': 'neutral',
        'versionScope': 'nonSxS'
      }));

      var inputLocStr = keyboard;
      if (keyboard.indexOf('{') === -1 && keyboard.length === 8) {
        var lcidPrefix = keyboard.substring(4);
        inputLocStr = lcidPrefix + ':' + keyboard;
      }
      oobeIntl.addSimpleElement('InputLocale', inputLocStr);
      oobeIntl.addSimpleElement('SystemLocale', locale);
      oobeIntl.addSimpleElement('UILanguage', uiLang);
      oobeIntl.addSimpleElement('UserLocale', locale);
    }

    var oobeShell = oobeSettingsElem.addChild(new XmlNode('component', {
      'name': 'Microsoft-Windows-Shell-Setup',
      'processorArchitecture': arch,
      'publicKeyToken': '31bf3856ad364e35',
      'language': 'neutral',
      'versionScope': 'nonSxS'
    }));

    if (userAccountMode === 'Unattended' && accounts.length > 0) {
      var userAccounts = oobeShell.addChild(new XmlNode('UserAccounts'));
      var localAccounts = userAccounts.addChild(new XmlNode('LocalAccounts'));
      for (var a = 0; a < accounts.length; a++) {
        var acc = accounts[a];
        var locAcc = localAccounts.addChild(new XmlNode('LocalAccount', { 'wcm:action': 'add' }));
        locAcc.addSimpleElement('Name', acc.name);
        locAcc.addSimpleElement('DisplayName', acc.displayName);
        locAcc.addSimpleElement('Group', acc.group);
        var pwElem = locAcc.addChild(new XmlNode('Password'));
        var pwVal = acc.password;
        if (obscurePasswords) {
          var encStr = '';
          for (var c = 0; c < (pwVal + 'Password').length; c++) {
            var code = (pwVal + 'Password').charCodeAt(c);
            encStr += String.fromCharCode(code & 0xff, (code >> 8) & 0xff);
          }
          pwVal = btoa(encStr);
        }
        pwElem.addSimpleElement('Value', pwVal);
        pwElem.addSimpleElement('PlainText', obscurePasswords ? 'false' : 'true');
      }

      if (autoLogonMode !== 'None') {
        var autoLogonElem = oobeShell.addChild(new XmlNode('AutoLogon'));
        var firstAdmin = accounts.find(function (acc) { return acc.group === 'Administrators'; }) || accounts[0];
        autoLogonElem.addSimpleElement('Username', firstAdmin.name);
        autoLogonElem.addSimpleElement('Enabled', 'true');
        autoLogonElem.addSimpleElement('LogonCount', '1');
        var alPwElem = autoLogonElem.addChild(new XmlNode('Password'));
        var alPwVal = firstAdmin.password;
        if (obscurePasswords) {
          var encStrAl = '';
          for (var c2 = 0; c2 < (alPwVal + 'Password').length; c2++) {
            var code2 = (alPwVal + 'Password').charCodeAt(c2);
            encStrAl += String.fromCharCode(code2 & 0xff, (code2 >> 8) & 0xff);
          }
          alPwVal = btoa(encStrAl);
        }
        alPwElem.addSimpleElement('Value', alPwVal);
        alPwElem.addSimpleElement('PlainText', obscurePasswords ? 'false' : 'true');
      }
    }

    var oobeSub = oobeShell.addChild(new XmlNode('OOBE'));
    if (expressSettings === 'DisableAll') {
      oobeSub.addSimpleElement('ProtectYourPC', '3');
    } else if (expressSettings === 'EnableAll') {
      oobeSub.addSimpleElement('ProtectYourPC', '1');
    }
    oobeSub.addSimpleElement('HideEULAPage', 'true');
    oobeSub.addSimpleElement('HideWirelessSetupInOOBE', 'false');
    oobeSub.addSimpleElement('HideOnlineAccountScreens', 'false');

    if (firstLogonFile) {
      var firstLogonCommands = oobeShell.addChild(new XmlNode('FirstLogonCommands'));
      var syncCmdOobe = firstLogonCommands.addChild(new XmlNode('SynchronousCommand', { 'wcm:action': 'add' }));
      syncCmdOobe.addSimpleElement('Order', '1');
      syncCmdOobe.addSimpleElement('CommandLine', 'powershell.exe -WindowStyle "Normal" -ExecutionPolicy "Unrestricted" -NoProfile -File "' + firstLogonFile + '"');
    }

    // 8. Extensions
    if (hasExtractScript || embeddedFiles.length > 0) {
      var extensionsElem = root.addChild(new XmlNode('Extensions', {
        'xmlns': 'https://schneegans.de/windows/unattend-generator/'
      }));

      var buildElem = extensionsElem.addChild(new XmlNode('Build'));
      var commitElem = buildElem.addChild(new XmlNode('Commit'));
      commitElem.addSimpleElement('Hash', commitHash);
      commitElem.addSimpleElement('GitHubUrl', 'https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP/commit/' + commitHash);

      if (hasExtractScript) {
        var extractScriptElem = extensionsElem.addChild(new XmlNode('ExtractScript'));
        extractScriptElem.addChild(new XmlNode(EXTRACT_SCRIPTS_PS1, null, null, true));
      }

      for (var f = 0; f < embeddedFiles.length; f++) {
        var fileElem = extensionsElem.addChild(new XmlNode('File', { 'path': embeddedFiles[f].path }));
        fileElem.addChild(new XmlNode(embeddedFiles[f].content, null, null, true));
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

  // Action dispatcher for View / Download / ISO
  function handleEngineAction(action, formElem, buttonElem) {
    var config = getConfig();

    // If configured for server mode and serverEndpoint is specified, use backend API
    if (config.mode === 'server' && config.serverEndpoint) {
      var actionUrl = config.serverEndpoint.replace(/\/+$/, '') + '/' + action + '/';
      formElem.action = actionUrl;
      formElem.method = 'POST';
      formElem.target = (action === 'view') ? '_blank' : '_self';
      formElem.submit();
      return true;
    }

    // Client mode
    var formData = new FormData(formElem);
    var xmlContent = generateAutounattendXml(formData);

    if (action === 'view') {
      var blob = new Blob([xmlContent], { type: 'text/xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return true;
    } else if (action === 'download') {
      var blobXml = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
      var dlUrl = URL.createObjectURL(blobXml);
      var a = document.createElement('a');
      a.href = dlUrl;
      a.download = 'autounattend.xml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(dlUrl); }, 10000);
      return true;
    } else if (action === 'iso') {
      var isoBlob = createIsoBlob('autounattend.xml', xmlContent);
      var isoUrl = URL.createObjectURL(isoBlob);
      var aIso = document.createElement('a');
      aIso.href = isoUrl;
      aIso.download = 'autounattend.iso';
      document.body.appendChild(aIso);
      aIso.click();
      document.body.removeChild(aIso);
      setTimeout(function () { URL.revokeObjectURL(isoUrl); }, 10000);
      return true;
    }

    return false;
  }

  // Extract query string from XML comment (e.g. <!--https://schneegans.de/windows/unattend-generator/?...-->)
  function extractQueryFromXml(xmlText) {
    if (!xmlText || typeof xmlText !== 'string') return null;
    var commentMatch = xmlText.match(/<!--\s*https?:\/\/[^?]*?\?([\s\S]*?)-->/);
    if (commentMatch && commentMatch[1]) {
      return commentMatch[1].trim();
    }
    return null;
  }

  // Helper to reliably find the main configuration form (holding #main-table and inputs)
  function getMainForm() {
    if (typeof document === 'undefined') return null;
    // 1. Form containing #main-table
    var mainTable = document.getElementById('main-table');
    if (mainTable) {
      var parentForm = mainTable.closest('form');
      if (parentForm) return parentForm;
    }
    // 2. Form containing core form inputs
    var langElem = document.querySelector('input[name="LanguageMode"], select[name="Locale"], select[name="ProcessorArchitecture"]');
    if (langElem && langElem.form) {
      return langElem.form;
    }
    // 3. Form with the most elements
    var forms = document.querySelectorAll('form');
    var bestForm = null;
    var maxElements = 0;
    for (var i = 0; i < forms.length; i++) {
      if (forms[i].elements && forms[i].elements.length > maxElements) {
        maxElements = forms[i].elements.length;
        bestForm = forms[i];
      }
    }
    return bestForm || document.querySelector('form');
  }


  // Apply parsed query parameters to form inputs
  function applyQueryToForm(queryString, targetForm) {
    if (!queryString || typeof document === 'undefined') return false;

    if (queryString.indexOf('?') === 0) {
      queryString = queryString.substring(1);
    }

    var params = new URLSearchParams(queryString);
    var form = targetForm || getMainForm();
    if (!form) return false;

    // 1. Radio buttons (apply first so dependent fieldsets get enabled/disabled correctly)
    var radios = form.querySelectorAll('input[type="radio"][name]');
    radios.forEach(function (rb) {
      var name = rb.name;
      if (params.has(name)) {
        var val = params.get(name);
        if (rb.value === val) {
          rb.checked = true;
          rb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    // 2. Checkboxes (reflect whether param exists in query string)
    var checkboxes = form.querySelectorAll('input[type="checkbox"][name]');
    checkboxes.forEach(function (cb) {
      var name = cb.name;
      var isChecked = false;
      if (params.has(name)) {
        var val = params.get(name);
        isChecked = (val === 'true' || val === 'on' || val === '' || val === cb.value);
      }
      cb.checked = isChecked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // 3. Account names first (enables password, display name, group inputs via whenEdited listener)
    var accountNames = form.querySelectorAll('input[name^="AccountName"]');
    accountNames.forEach(function (input) {
      var name = input.name;
      var val = params.has(name) ? params.get(name) : '';
      input.value = val;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // 4. Select boxes (single & multiple)
    var selects = form.querySelectorAll('select[name]');
    selects.forEach(function (sel) {
      var name = sel.name;
      if (params.has(name)) {
        if (sel.multiple) {
          var allVals = params.getAll(name);
          for (var i = 0; i < sel.options.length; i++) {
            sel.options[i].selected = allVals.indexOf(sel.options[i].value) !== -1;
          }
        } else {
          var val = params.get(name);
          sel.value = val;
        }
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // 5. All other text/textarea/password inputs
    var textInputs = form.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]), textarea');
    textInputs.forEach(function (input) {
      var name = input.name;
      if (name && name.indexOf('AccountName') !== 0 && params.has(name)) {
        var val = params.get(name);
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // 6. Dependent / sequential controls (Locale overrides Keyboard & GeoLocation on change)
    var dependentKeys = ['Keyboard', 'GeoLocation', 'Keyboard2', 'Keyboard3', 'AccountGroup0', 'AccountGroup1', 'AccountGroup2', 'AccountGroup3', 'AccountGroup4', 'AccountGroup5', 'AccountGroup6', 'AccountGroup7', 'AccountGroup8', 'AccountGroup9'];
    dependentKeys.forEach(function (key) {
      if (params.has(key)) {
        var el = form.querySelector('select[name="' + key + '"], input[name="' + key + '"]');
        if (el) {
          el.value = params.get(key);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    return true;
  }

  // Fallback: parse XML DOM when comment query string is absent
  function applyXmlDomToForm(xmlDoc, targetForm) {
    if (!xmlDoc || typeof document === 'undefined') return false;

    var form = targetForm || getMainForm();
    if (!form) return false;

    // UILanguage / Locale
    var uiLang = xmlDoc.querySelector('UILanguage');
    if (uiLang && uiLang.textContent) {
      var langVal = uiLang.textContent.trim();
      var selLocale = form.querySelector('select[name="Locale"]');
      if (selLocale) {
        selLocale.value = langVal;
        selLocale.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // InputLocale / Keyboard
    var inputLocale = xmlDoc.querySelector('InputLocale');
    if (inputLocale && inputLocale.textContent) {
      var inLocText = inputLocale.textContent.trim();
      var parts = inLocText.split(':');
      var kbCode = parts.length > 1 ? parts[1] : parts[0];
      var selKb = form.querySelector('select[name="Keyboard"]');
      if (selKb) {
        selKb.value = kbCode;
        selKb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // GeoLocation
    var geoLoc = xmlDoc.querySelector('GeoLocation');
    if (geoLoc && geoLoc.textContent) {
      var selGeo = form.querySelector('select[name="GeoLocation"]');
      if (selGeo) {
        selGeo.value = geoLoc.textContent.trim();
        selGeo.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // ComputerName
    var compElem = xmlDoc.querySelector('ComputerName');
    if (compElem && compElem.textContent) {
      var compVal = compElem.textContent.trim();
      if (compVal && compVal !== '*') {
        var rCustom = form.querySelector('input[name="ComputerNameMode"][value="Custom"]');
        if (rCustom) {
          rCustom.checked = true;
          rCustom.dispatchEvent(new Event('change', { bubbles: true }));
        }
        var compInp = form.querySelector('input[name="ComputerName"]');
        if (compInp) {
          compInp.value = compVal;
          compInp.dispatchEvent(new Event('input', { bubbles: true }));
          compInp.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }

    // TimeZone
    var tzElem = xmlDoc.querySelector('TimeZone');
    if (tzElem && tzElem.textContent) {
      var tzVal = tzElem.textContent.trim();
      var tzSel = form.querySelector('select[name="TimeZone"]');
      if (tzSel) {
        var rTzCustom = form.querySelector('input[name="TimeZoneMode"][value="Explicit"]');
        if (rTzCustom) {
          rTzCustom.checked = true;
          rTzCustom.dispatchEvent(new Event('change', { bubbles: true }));
        }
        tzSel.value = tzVal;
        tzSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // LocalAccounts
    var localAccs = xmlDoc.querySelectorAll('LocalAccount');
    if (localAccs && localAccs.length > 0) {
      var rAccUnattended = form.querySelector('input[name="UserAccountMode"][value="Unattended"]');
      if (rAccUnattended) {
        rAccUnattended.checked = true;
        rAccUnattended.dispatchEvent(new Event('change', { bubbles: true }));
      }
      localAccs.forEach(function (acc, idx) {
        var name = acc.querySelector('Name') ? acc.querySelector('Name').textContent.trim() : '';
        var disp = acc.querySelector('DisplayName') ? acc.querySelector('DisplayName').textContent.trim() : '';
        var grp = acc.querySelector('Group') ? acc.querySelector('Group').textContent.trim() : '';
        var passElem = acc.querySelector('Password > Value');
        var pass = passElem ? passElem.textContent.trim() : '';

        if (name) {
          var nameInp = form.querySelector('input[name="AccountName' + idx + '"]');
          if (nameInp) {
            nameInp.value = name;
            nameInp.dispatchEvent(new Event('input', { bubbles: true }));
            nameInp.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        if (disp) {
          var dispInp = form.querySelector('input[name="AccountDisplayName' + idx + '"]');
          if (dispInp) {
            dispInp.value = disp;
            dispInp.dispatchEvent(new Event('input', { bubbles: true }));
            dispInp.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        if (grp) {
          var grpSel = form.querySelector('select[name="AccountGroup' + idx + '"]');
          if (grpSel) {
            grpSel.value = grp;
            grpSel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
        if (passElem) {
          var passInp = form.querySelector('input[name="AccountPassword' + idx + '"]');
          if (passInp) {
            passInp.value = pass;
            passInp.dispatchEvent(new Event('input', { bubbles: true }));
            passInp.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
    }

    return true;
  }
  // Override form values with actual XML DOM elements (prioritizing XML body over comment query)
  function overrideFormFromXmlDom(xmlDoc, targetForm, params) {
    if (!xmlDoc || typeof document === 'undefined') return false;

    var form = targetForm || getMainForm();
    if (!form) return false;

    // 1. LocalAccounts: override account names, display names, groups, and passwords from XML body
    var localAccs = xmlDoc.querySelectorAll('LocalAccount');
    if (localAccs && localAccs.length > 0) {
      var rAccUnattended = form.querySelector('input[name="UserAccountMode"][value="Unattended"]');
      if (rAccUnattended && !rAccUnattended.checked) {
        rAccUnattended.checked = true;
        rAccUnattended.dispatchEvent(new Event('change', { bubbles: true }));
        if (params) params.set('UserAccountMode', 'Unattended');
      }

      localAccs.forEach(function (acc, idx) {
        var nameElem = acc.querySelector('Name');
        var dispElem = acc.querySelector('DisplayName');
        var grpElem = acc.querySelector('Group');
        var passElem = acc.querySelector('Password > Value');

        if (nameElem) {
          var name = nameElem.textContent ? nameElem.textContent.trim() : '';
          var nameInp = form.querySelector('input[name="AccountName' + idx + '"]');
          if (nameInp) {
            nameInp.value = name;
            nameInp.dispatchEvent(new Event('input', { bubbles: true }));
            nameInp.dispatchEvent(new Event('change', { bubbles: true }));
            if (params) params.set('AccountName' + idx, name);
          }
        }

        if (dispElem) {
          var disp = dispElem.textContent ? dispElem.textContent.trim() : '';
          var dispInp = form.querySelector('input[name="AccountDisplayName' + idx + '"]');
          if (dispInp) {
            dispInp.value = disp;
            dispInp.dispatchEvent(new Event('input', { bubbles: true }));
            dispInp.dispatchEvent(new Event('change', { bubbles: true }));
            if (params) params.set('AccountDisplayName' + idx, disp);
          }
        }

        if (grpElem) {
          var grp = grpElem.textContent ? grpElem.textContent.trim() : '';
          var grpSel = form.querySelector('select[name="AccountGroup' + idx + '"]');
          if (grpSel && grp) {
            grpSel.value = grp;
            grpSel.dispatchEvent(new Event('change', { bubbles: true }));
            if (params) params.set('AccountGroup' + idx, grp);
          }
        }

        if (passElem) {
          var pass = passElem.textContent ? passElem.textContent.trim() : '';
          var passInp = form.querySelector('input[name="AccountPassword' + idx + '"]');
          if (passInp) {
            passInp.value = pass;
            passInp.dispatchEvent(new Event('input', { bubbles: true }));
            passInp.dispatchEvent(new Event('change', { bubbles: true }));
            if (params) params.set('AccountPassword' + idx, pass);
          }
        }
      });
    }

    // 2. ProductKey: override if custom key is present in XML body
    var keyElem = xmlDoc.querySelector('ProductKey > Key');
    if (keyElem && keyElem.textContent) {
      var prodKey = keyElem.textContent.trim();
      var keyInp = form.querySelector('input[name="ProductKey"]');
      if (keyInp && prodKey) {
        var rCustomKey = form.querySelector('input[name="ProductKeyMode"][value="Custom"]');
        if (rCustomKey && !rCustomKey.checked) {
          rCustomKey.checked = true;
          rCustomKey.dispatchEvent(new Event('change', { bubbles: true }));
          if (params) params.set('ProductKeyMode', 'Custom');
        }
        keyInp.value = prodKey;
        keyInp.dispatchEvent(new Event('input', { bubbles: true }));
        keyInp.dispatchEvent(new Event('change', { bubbles: true }));
        if (params) params.set('ProductKey', prodKey);
      }
    }

    return true;
  }


  // File import dispatcher using FileReader
  function importXmlFile(file, callback, targetForm) {
    if (!file) {
      if (callback) callback(new Error('ファイルが指定されていません。'));
      return;
    }
    if (typeof FileReader === 'undefined') {
      var err = new Error('FileReader API に対応していません。');
      if (callback) callback(err);
      return;
    }

    var form = targetForm || getMainForm();
    var reader = new FileReader();
    reader.onload = function (evt) {
      try {
        var text = evt.target.result;
        var query = extractQueryFromXml(text);
        var ok = false;

        var xmlDoc = null;
        if (typeof DOMParser !== 'undefined') {
          try {
            var parser = new DOMParser();
            xmlDoc = parser.parseFromString(text, 'application/xml');
            if (xmlDoc.querySelector('parsererror')) {
              xmlDoc = null;
            }
          } catch (pe) {
            xmlDoc = null;
          }
        }

        if (query) {
          ok = applyQueryToForm(query, form);
          var params = null;
          try {
            params = new URLSearchParams(query.indexOf('?') === 0 ? query.substring(1) : query);
          } catch (e) {
            params = null;
          }

          // Override form values with actual XML DOM elements (prioritizing XML body over comment query)
          if (xmlDoc) {
            overrideFormFromXmlDom(xmlDoc, form, params);
          }

          var finalQuery = params ? params.toString() : query;
          if (ok && typeof window !== 'undefined' && window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '?' + finalQuery);
          }
        } else {
          if (!xmlDoc) {
            var parseErr = new Error('XMLファイルの解析に失敗しました。書式が無効です。');
            if (callback) callback(parseErr);
            else alert(parseErr.message);
            return;
          }
          ok = applyXmlDomToForm(xmlDoc, form);
        }

        if (ok) {
          if (callback) {
            callback(null, true);
          } else {
            alert('XMLファイルの設定を正常にインポートしました。');
          }
        } else {
          var failErr = new Error('XML設定の反映に失敗しました。');
          if (callback) callback(failErr);
          else alert(failErr.message);
        }
      } catch (e) {
        console.error('importXmlFile error:', e);
        if (callback) callback(e);
        else alert('インポート処理中にエラーが発生しました: ' + e.message);
      }
    };
    reader.onerror = function (e) {
      if (callback) callback(e);
      else alert('ファイルの読み込みに失敗しました。');
    };
    reader.readAsText(file);
  }

  // Restore form state from window.location.search
  function restoreFromUrlQuery(targetForm) {
    if (typeof window === 'undefined' || !window.location || !window.location.search) {
      return false;
    }
    var search = window.location.search;
    if (search.length > 1) {
      return applyQueryToForm(search, targetForm || getMainForm());
    }
    return false;
  }

  // Setup form submission interceptor
  function initEngine() {
    if (typeof document === 'undefined') return;

    // 1. Intercept buttons (View, ISO, Download, and Import)
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('button, input[type="submit"]');
      if (!btn) return;

      var formaction = btn.getAttribute('formaction') || '';
      var text = (btn.textContent || btn.value || '').trim();

      // Check if button is "Import file"
      var isImportButton = text.indexOf('Import file') !== -1 ||
                           text.indexOf('ファイルのインポート') !== -1 ||
                           (btn.form && btn.form.querySelector('#Upload'));

      if (isImportButton) {
        e.preventDefault();
        e.stopPropagation();
        var uploadInput = document.getElementById('Upload') || (btn.form && btn.form.querySelector('input[type="file"]'));
        if (uploadInput && uploadInput.files && uploadInput.files.length > 0) {
          importXmlFile(uploadInput.files[0], null, getMainForm());
        } else {
          alert('インポートするXMLファイルを選択してください。');
        }
        return;
      }

      // Check if button is View / ISO / Download
      var actionType = null;
      if (formaction.indexOf('view') !== -1) {
        actionType = 'view';
      } else if (formaction.indexOf('iso') !== -1) {
        actionType = 'iso';
      } else if (formaction.indexOf('download') !== -1) {
        actionType = 'download';
      }

      if (actionType) {
        var form = (btn.form && btn.form.elements && btn.form.elements.length > 10) ? btn.form : getMainForm();
        if (form) {
          e.preventDefault();
          e.stopPropagation();
          handleEngineAction(actionType, form, btn);
        }
      }
    }, true);

    // 2. Intercept form submit to prevent HTTP POST (405 error on static server)
    document.addEventListener('submit', function (e) {
      if (e.target && (e.target.querySelector('#Upload') || e.target.getAttribute('enctype') === 'multipart/form-data')) {
        e.preventDefault();
        e.stopPropagation();
        var uploadInput = e.target.querySelector('#Upload') || e.target.querySelector('input[type="file"]');
        if (uploadInput && uploadInput.files && uploadInput.files.length > 0) {
          importXmlFile(uploadInput.files[0], null, getMainForm());
        } else {
          alert('インポートするXMLファイルを選択してください。');
        }
      }
    }, true);

    // 3. Auto-restore form from URL query parameters if present
    if (typeof window !== 'undefined' && window.location && window.location.search && window.location.search.length > 1) {
      var restoreAttempts = 0;
      var tryRestore = function () {
        restoreAttempts++;
        var mainForm = getMainForm();
        if (mainForm && mainForm.elements && mainForm.elements.length > 10) {
          restoreFromUrlQuery(mainForm);
        } else if (restoreAttempts < 50) {
          setTimeout(tryRestore, 100);
        }
      };
      tryRestore();
    }
  }

  // Auto-init on DOM ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initEngine);
    } else {
      initEngine();
    }
  }

  // Export for testing & API usage
  var unattendEngine = {
    getConfig: getConfig,
    getMainForm: getMainForm,
    generateAutounattendXml: generateAutounattendXml,
    createIsoBlob: createIsoBlob,
    handleEngineAction: handleEngineAction,
    extractQueryFromXml: extractQueryFromXml,
    applyQueryToForm: applyQueryToForm,
    applyXmlDomToForm: applyXmlDomToForm,
    overrideFormFromXmlDom: overrideFormFromXmlDom,
    importXmlFile: importXmlFile,
    restoreFromUrlQuery: restoreFromUrlQuery
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = unattendEngine;
  } else {
    global.UnattendEngine = unattendEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);

