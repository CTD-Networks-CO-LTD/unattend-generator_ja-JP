/**
 * Optimizations modifier matching C# Optimizations.cs and baseline_unattend_engine.js
 */
if (typeof SET_START_PINS_PS1 === 'undefined' && typeof require !== 'undefined') {
  var constants = require('../core/constants');
  SET_START_PINS_PS1 = constants.SET_START_PINS_PS1;
  UNLOCK_START_LAYOUT_VBS = constants.UNLOCK_START_LAYOUT_VBS;
  UNLOCK_START_LAYOUT_XML = constants.UNLOCK_START_LAYOUT_XML;
  PAUSE_WINDOWS_UPDATE_XML = constants.PAUSE_WINDOWS_UPDATE_XML;
  MOVE_ACTIVE_HOURS_XML = constants.MOVE_ACTIVE_HOURS_XML;
}

function OptimizationsModifier(context) {
  this.context = context;
}

OptimizationsModifier.prototype.process = function () {
  var ctx = this.context;
  var userOnceScript = ctx.sequences.userOnce;
  var defaultUserScript = ctx.sequences.defaultUser;
  var specializeScript = ctx.sequences.specialize;
  var firstLogonScript = ctx.sequences.firstLogon;

  // 1. ClassicContextMenu
  if (ctx.getBool('ClassicContextMenu', false)) {
    userOnceScript.append('reg.exe add "HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32" /ve /f;');
    userOnceScript.restartExplorer();
  }

  // 2. ShowFileExtensions
  if (ctx.getBool('ShowFileExtensions', false) || ctx.getBool('HideFileExt', false)) {
    defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "HideFileExt" /t REG_DWORD /d 0 /f;');
  }

  // 3. HideFiles
  var hideFiles = ctx.getVal('HideFiles', 'Hidden');
  if (hideFiles === 'None') {
    defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "Hidden" /t REG_DWORD /d 1 /f;');
    defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "ShowSuperHidden" /t REG_DWORD /d 1 /f;');
  } else if (hideFiles === 'HiddenSystem') {
    defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "Hidden" /t REG_DWORD /d 1 /f;');
  }

  // 4. DisableWindowsUpdate
  if (ctx.getBool('DisableWindowsUpdate', false)) {
    var pauseXml = typeof PAUSE_WINDOWS_UPDATE_XML !== 'undefined' ? PAUSE_WINDOWS_UPDATE_XML : '';
    var pauseXmlPath = ctx.embedTextFile('PauseWindowsUpdate.xml', pauseXml);
    specializeScript.append("Register-ScheduledTask -TaskName 'PauseWindowsUpdate' -Xml $( Get-Content -LiteralPath '" + pauseXmlPath + "' -Raw );");
  }

  // 5. HideTaskViewButton
  if (ctx.getBool('HideTaskViewButton', false)) {
    defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowTaskViewButton /t REG_DWORD /d 0 /f;');
  }

  // 6. DisableSmartScreen
  if (ctx.getBool('DisableSmartScreen', false)) {
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

  // 7. DisableUac
  if (ctx.getBool('DisableUac', false)) {
    specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v EnableLUA /t REG_DWORD /d 0 /f');
  }

  // 8. EnableLongPaths
  if (ctx.getBool('EnableLongPaths', false)) {
    specializeScript.append('reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f');
  }

  // 9. EnableRemoteDesktop
  if (ctx.getBool('EnableRemoteDesktop', false)) {
    specializeScript.append([
      'netsh.exe advfirewall firewall set rule group="@FirewallAPI.dll,-28752" new enable=Yes;',
      'reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f;'
    ].join('\r\n'));
  }

  // 10. PreventAutomaticReboot
  if (ctx.getBool('PreventAutomaticReboot', false)) {
    specializeScript.append([
      'reg.exe add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v AUOptions /t REG_DWORD /d 4 /f;',
      'reg.exe add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU" /v NoAutoRebootWithLoggedOnUsers /t REG_DWORD /d 1 /f;'
    ].join('\r\n'));
    var moveXml = typeof MOVE_ACTIVE_HOURS_XML !== 'undefined' ? MOVE_ACTIVE_HOURS_XML : '';
    var moveXmlPath = ctx.embedTextFile('MoveActiveHours.xml', moveXml);
    specializeScript.append("Register-ScheduledTask -TaskName 'MoveActiveHours' -Xml $( Get-Content -LiteralPath '" + moveXmlPath + "' -Raw );");
  }

  // 11. DisableFastStartup
  if (ctx.getBool('DisableFastStartup', false)) {
    specializeScript.append('reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f;');
  }

  // 12. DisableSystemRestore
  if (ctx.getBool('DisableSystemRestore', false)) {
    firstLogonScript.append("Disable-ComputerRestore -Drive 'C:\\';");
  }

  // 13. DisableWidgets
  if (ctx.getBool('DisableWidgets', false)) {
    specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Dsh" /v AllowNewsAndInterests /t REG_DWORD /d 0 /f;');
  }

  // 14. DisableAppSuggestions
  if (ctx.getBool('DisableAppSuggestions', false)) {
    defaultUserScript.append([
      '$names = @(',
      "  'ContentDeliveryAllowed';",
      "  'FeatureManagementEnabled';",
      "  'OEMPreInstalledAppsEnabled';",
      "  'PreInstalledAppsEnabled';",
      "  'PreInstalledAppsEverEnabled';",
      "  'SilentInstalledAppsEnabled';",
      "  'SoftLandingEnabled';",
      "  'SubscribedContentEnabled';",
      "  'SubscribedContent-310093Enabled';",
      "  'SubscribedContent-338387Enabled';",
      "  'SubscribedContent-338388Enabled';",
      "  'SubscribedContent-338389Enabled';",
      "  'SubscribedContent-338393Enabled';",
      "  'SubscribedContent-353694Enabled';",
      "  'SubscribedContent-353696Enabled';",
      "  'SubscribedContent-353698Enabled';",
      "  'SystemPaneSuggestionsEnabled';",
      ');',
      'foreach( $name in $names ) {',
      '  reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager" /v $name /t REG_DWORD /d 0 /f;',
      '}'
    ].join('\r\n'));
    specializeScript.append(
      'reg.exe add "HKLM\\Software\\Policies\\Microsoft\\Windows\\CloudContent" /v "DisableWindowsConsumerFeatures" /t REG_DWORD /d 1 /f;'
    );
  }

  // 15. VM Tools
  if (ctx.getBool('VBoxGuestAdditions', false)) {
    ctx.embedTextFile('VBoxGuestAdditions.ps1', [
      "foreach( $letter in 'DEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray() ) {",
      '\t$exe = "${letter}:\\VBoxWindowsAdditions.exe";',
      '\tif( Test-Path -LiteralPath $exe ) {',
      '\t\t$certs = "${letter}:\\cert";',
      '\t\tStart-Process -FilePath "${certs}\\VBoxCertUtil.exe" -ArgumentList "add-trusted-publisher ${certs}\\vbox*.cer", "--root ${certs}\\vbox*.cer"  -Wait;',
      "\t\tStart-Process -FilePath $exe -ArgumentList '/with_wddm', '/S' -Wait;",
      '\t\treturn;',
      '\t}',
      '}',
      "'VBoxGuestAdditions.iso is not attached to this VM.';"
    ].join('\r\n'));
    firstLogonScript.invokeFile('C:\\Windows\\Setup\\Scripts\\VBoxGuestAdditions.ps1');
  }
  if (ctx.getBool('VMwareTools', false)) {
    ctx.embedTextFile('VMwareTools.ps1', [
      "foreach( $letter in 'DEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray() ) {",
      '\t$exe = "${letter}:\\setup.exe";',
      "\tif( ( Get-Item -LiteralPath $exe -ErrorAction 'SilentlyContinue' | Select-Object -ExpandProperty 'VersionInfo' | Select-Object -ExpandProperty 'ProductName' ) -eq 'VMware Tools' ) {",
      "\t\tStart-Process -FilePath $exe -ArgumentList '/s /v /qn REBOOT=R' -Wait;",
      '\t\treturn;',
      '\t}',
      '}',
      "'VMware Tools image (windows.iso) is not attached to this VM.';"
    ].join('\r\n'));
    firstLogonScript.invokeFile('C:\\Windows\\Setup\\Scripts\\VMwareTools.ps1');
  }
  if (ctx.getBool('VirtIoGuestTools', false)) {
    ctx.embedTextFile('VirtIoGuestTools.ps1', [
      "foreach( $letter in 'DEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray() ) {",
      '\t$exe = "${letter}:\\virtio-win-guest-tools.exe";',
      '\tif( Test-Path -LiteralPath $exe ) {',
      "\t\tStart-Process -FilePath $exe -ArgumentList '/passive', '/norestart' -Wait;",
      '\t\treturn;',
      '\t}',
      '}',
      "'VirtIO Guest Tools image (virtio-win-*.iso) is not attached to this VM.';"
    ].join('\r\n'));
    firstLogonScript.invokeFile('C:\\Windows\\Setup\\Scripts\\VirtIoGuestTools.ps1');
  }

  // 16. PreventDeviceEncryption
  if (ctx.getBool('PreventDeviceEncryption', false)) {
    specializeScript.append('reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\BitLocker" /v "PreventDeviceEncryption" /t REG_DWORD /d 1 /f;');
  }

  // 17. LeftTaskbar
  if (ctx.getBool('LeftTaskbar', false)) {
    defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAl /t REG_DWORD /d 0 /f;');
  }

  // 18. HideEdgeFre
  if (ctx.getBool('HideEdgeFre', false)) {
    specializeScript.append('reg.exe add "HKLM\\Software\\Policies\\Microsoft\\Edge" /v HideFirstRunExperience /t REG_DWORD /d 1 /f;');
  }

  // 19. MakeEdgeUninstallable
  if (ctx.getBool('MakeEdgeUninstallable', false)) {
    ctx.embedTextFile('MakeEdgeUninstallable.ps1', [
      'try {',
      '\t$params = @{',
      "\t\tLiteralPath = 'C:\\Windows\\System32\\IntegratedServicesRegionPolicySet.json';",
      "\t\tEncoding = 'Utf8';",
      '\t};',
      '\t$o = Get-Content @params | ConvertFrom-Json;',
      '\t$o.policies | ForEach-Object -Process {',
      "\t\tif( $_.guid -eq '{1bca278a-5d11-4acf-ad2f-f9ab6d7f93a6}' ) {",
      "\t\t\t$_.defaultState = 'enabled';",
      '\t\t}',
      '\t};',
      '\t$o | ConvertTo-Json -Depth 9 | Out-File @params;',
      '} catch {',
      '\t$_;',
      '}'
    ].join('\r\n'));
    specializeScript.invokeFile('C:\\Windows\\Setup\\Scripts\\MakeEdgeUninstallable.ps1');
  }

  // 20. LaunchToThisPC
  if (ctx.getBool('LaunchToThisPC', false)) {
    userOnceScript.append("Set-ItemProperty -LiteralPath 'Registry::HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name 'LaunchTo' -Type 'DWord' -Value 1;");
  }

  // 21. TaskbarSearch
  var taskbarSearch = ctx.getVal('TaskbarSearch', 'Box');
  var taskbarSearchMap = { 'Hide': 0, 'Icon': 1, 'Box': 2, 'Label': 3 };
  if (taskbarSearch in taskbarSearchMap && taskbarSearch !== 'Box') {
    userOnceScript.append("Set-ItemProperty -LiteralPath 'Registry::HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' -Name 'SearchboxTaskbarMode' -Type 'DWord' -Value " + taskbarSearchMap[taskbarSearch] + ";");
    userOnceScript.restartExplorer();
  }

  // 22. StartPins
  var startPinsMode = ctx.getVal('StartPinsMode', 'Default');
  var startPinsJson = '';
  if (startPinsMode === 'Empty') {
    startPinsJson = '{"pinnedList":[]}';
  } else if (startPinsMode === 'Custom') {
    startPinsJson = ctx.getVal('StartPinsJson', '').trim();
  }
  if (startPinsJson) {
    var escapedJson = startPinsJson.replace(/'/g, "''");
    var startPinsContent = "$json = '" + escapedJson + "';\r\n" + SET_START_PINS_PS1;
    var startPinsFile = ctx.embedTextFile('SetStartPins.ps1', startPinsContent);
    specializeScript.invokeFile(startPinsFile);
  }

  // 23. TaskbarIcons
  var taskbarMode = ctx.getVal('TaskbarIconsMode', 'Default');
  var taskbarXml = '';
  if (taskbarMode === 'Empty') {
    taskbarXml = [
      '<LayoutModificationTemplate xmlns="http://schemas.microsoft.com/Start/2014/LayoutModification" xmlns:defaultlayout="http://schemas.microsoft.com/Start/2014/FullDefaultLayout" xmlns:start="http://schemas.microsoft.com/Start/2014/StartLayout" xmlns:taskbar="http://schemas.microsoft.com/Start/2014/TaskbarLayout" Version="1">',
      '  <CustomTaskbarLayoutCollection PinListPlacement="Replace">',
      '    <defaultlayout:TaskbarLayout>',
      '      <taskbar:TaskbarPinList>',
      '        <taskbar:DesktopApp DesktopApplicationLinkPath="#leaveempty" />',
      '      </taskbar:TaskbarPinList>',
      '    </defaultlayout:TaskbarLayout>',
      '  </CustomTaskbarLayoutCollection>',
      '</LayoutModificationTemplate>'
    ].join('\r\n');
  } else if (taskbarMode === 'Custom') {
    taskbarXml = ctx.getVal('TaskbarIconsXml', '').trim();
  }
  if (taskbarXml) {
    taskbarXml = taskbarXml.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
    var taskbarPath = ctx.embedTextFile('TaskbarLayoutModification.xml', taskbarXml);
    specializeScript.append(
      'reg.exe add "HKLM\\Software\\Policies\\Microsoft\\Windows\\CloudContent" /v "DisableCloudOptimizedContent" /t REG_DWORD /d 1 /f;\r\n' +
      "[System.Diagnostics.EventLog]::CreateEventSource( 'UnattendGenerator', 'Application' );"
    );
    defaultUserScript.append(
      'reg.exe add "HKU\\DefaultUser\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v "StartLayoutFile" /t REG_SZ /d "' + taskbarPath + '" /f;\r\n' +
      'reg.exe add "HKU\\DefaultUser\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v "LockedStartLayout" /t REG_DWORD /d 1 /f;'
    );
    ctx.embedTextFile('UnlockStartLayout.vbs', UNLOCK_START_LAYOUT_VBS);
    var unlockXmlPath = ctx.embedTextFile('UnlockStartLayout.xml', UNLOCK_START_LAYOUT_XML);
    specializeScript.append("Register-ScheduledTask -TaskName 'UnlockStartLayout' -Xml $( Get-Content -LiteralPath '" + unlockXmlPath + "' -Raw );");
    userOnceScript.append(
      "[System.Diagnostics.EventLog]::WriteEntry( 'UnattendGenerator', \"User '$env:USERNAME' has requested to unlock the Start menu layout.\", [System.Diagnostics.EventLogEntryType]::Information, 1 );"
    );
  }

  // 24. DisablePointerPrecision
  if (ctx.getBool('DisablePointerPrecision', false)) {
    defaultUserScript.append([
      '$params = @{',
      "  LiteralPath = 'Registry::HKU\\DefaultUser\\Control Panel\\Mouse';",
      "  Type = 'String';",
      "  Value = 0;",
      "  Force = $true;",
      '};',
      "Set-ItemProperty @params -Name 'MouseSpeed';",
      "Set-ItemProperty @params -Name 'MouseThreshold1';",
      "Set-ItemProperty @params -Name 'MouseThreshold2';"
    ].join('\r\n'));
  }

  // 25. DisableBingResults
  if (ctx.getBool('DisableBingResults', false)) {
    defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Policies\\Microsoft\\Windows\\Explorer" /v DisableSearchBoxSuggestions /t REG_DWORD /d 1 /f;');
  }

  // 26. EffectsMode
  var effectsMode = ctx.getVal('EffectsMode', 'Default');
  var effectKeys = [
    'ControlAnimations', 'AnimateMinMax', 'TaskbarAnimations', 'DWMAeroPeekEnabled',
    'MenuAnimation', 'TooltipAnimation', 'SelectionFade', 'DWMSaveThumbnailEnabled',
    'CursorShadow', 'ListviewShadow', 'ThumbnailsOrIcon', 'ListviewAlphaSelect',
    'DragFullWindows', 'ComboBoxAnimation', 'FontSmoothing', 'ListBoxSmoothScrolling', 'DropShadow'
  ];
  if (effectsMode === 'Custom' || effectsMode === 'Appearance' || effectsMode === 'Performance') {
    var fxVal = effectsMode === 'Appearance' ? 1 : (effectsMode === 'Performance' ? 2 : 3);
    var fxLines = [];
    for (var e = 0; e < effectKeys.length; e++) {
      var k = effectKeys[e];
      var enabled = effectsMode === 'Appearance' ? true : (effectsMode === 'Performance' ? false : ctx.getBool(k, false));
      fxLines.push('Set-ItemProperty -LiteralPath "Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects\\' + k + '" -Name \'DefaultValue\' -Value ' + (enabled ? 1 : 0) + ' -Type \'DWord\' -Force;');
    }
    specializeScript.append(fxLines.join('\r\n'));
    userOnceScript.append("Set-ItemProperty -LiteralPath 'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name 'VisualFXSetting' -Type 'DWord' -Value " + fxVal + " -Force;");
  }

  // 27. DesktopIconsMode
  var desktopIconsMode = ctx.getVal('DesktopIconsMode', 'Default');
  if (desktopIconsMode === 'Custom') {
    var iconDefs = [
      { id: 'IconControlPanel', guid: '{5399e694-6ce5-4d6c-8fce-1d8870fdcba0}' },
      { id: 'IconDesktop', guid: '{b4bfcc3a-db2c-424c-b029-7fe99a87c641}' },
      { id: 'IconDocuments', guid: '{a8cdff1c-4878-43be-b5fd-f8091c1c60d0}' },
      { id: 'IconDownloads', guid: '{374de290-123f-4565-9164-39c4925e467b}' },
      { id: 'IconGallery', guid: '{e88865ea-0e1c-4e20-9aa6-edcd0212c87c}' },
      { id: 'IconHome', guid: '{f874310e-b6b7-47dc-bc84-b9e6b38f5903}' },
      { id: 'IconMusic', guid: '{1cf1260c-4dd0-4ebb-811f-33c572699fde}' },
      { id: 'IconNetwork', guid: '{f02c1a0d-be21-4350-88b0-7367fc96ef3c}' },
      { id: 'IconPictures', guid: '{3add1653-eb32-4cb0-bbd7-dfa0abb5acca}' },
      { id: 'IconRecycleBin', guid: '{645ff040-5081-101b-9f08-00aa002f954e}' },
      { id: 'IconThisPC', guid: '{20d04fe0-3aea-1069-a2d8-08002b30309d}' },
      { id: 'IconUserFiles', guid: '{59031a47-3f72-44a7-89c5-5595fe6b30ee}' },
      { id: 'IconVideos', guid: '{a0953c92-50dc-43bf-be83-3742fed03c9c}' }
    ];
    var iconLines = [];
    var iconKeys = ['ClassicStartMenu', 'NewStartPanel'];
    for (var ik = 0; ik < iconKeys.length; ik++) {
      var ip = "Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\HideDesktopIcons\\" + iconKeys[ik];
      iconLines.push("New-Item -Path '" + ip + "' -Force;");
      for (var id = 0; id < iconDefs.length; id++) {
        var ic = iconDefs[id];
        var iconEnabled = ctx.getBool(ic.id, false);
        iconLines.push("Set-ItemProperty -Path '" + ip + "' -Name '" + ic.guid + "' -Value " + (iconEnabled ? 0 : 1) + " -Type 'DWord';");
      }
    }
    userOnceScript.append(iconLines.join('\r\n'));
    userOnceScript.restartExplorer();
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptimizationsModifier: OptimizationsModifier };
}
