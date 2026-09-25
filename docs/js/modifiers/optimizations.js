/**
 * Optimizations modifier matching baseline_unattend_engine.js
 */
if (typeof SET_START_PINS_PS1 === 'undefined' && typeof require !== 'undefined') {
  var constants = require('../core/constants');
  SET_START_PINS_PS1 = constants.SET_START_PINS_PS1;
  UNLOCK_START_LAYOUT_VBS = constants.UNLOCK_START_LAYOUT_VBS;
  UNLOCK_START_LAYOUT_XML = constants.UNLOCK_START_LAYOUT_XML;
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

  // Optimizations & Registry
    if (ctx.getBool('ClassicContextMenu', false)) {
      userOnceScript.append('reg.exe add "HKCU\\Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32" /ve /f;');
      userOnceScript.restartExplorer();
    }
    if (ctx.getBool('ShowFileExtensions', false) || ctx.getBool('HideFileExt', false)) {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "HideFileExt" /t REG_DWORD /d 0 /f;');
    }
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
    var hideFiles = ctx.getVal('HideFiles', 'Hidden');
    if (hideFiles === 'None') {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "Hidden" /t REG_DWORD /d 1 /f;');
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "ShowSuperHidden" /t REG_DWORD /d 1 /f;');
    } else if (hideFiles === 'HiddenSystem') {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v "Hidden" /t REG_DWORD /d 1 /f;');
    }
    if (ctx.getBool('LeftTaskbar', false)) {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v TaskbarAl /t REG_DWORD /d 0 /f;');
    }
    if (ctx.getBool('HideTaskViewButton', false)) {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" /v ShowTaskViewButton /t REG_DWORD /d 0 /f;');
    }
    if (ctx.getBool('DisableFastStartup', false)) {
      specializeScript.append('reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f;');
    }
    if (ctx.getBool('DisableWidgets', false)) {
      specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Dsh" /v AllowNewsAndInterests /t REG_DWORD /d 0 /f;');
    }
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
    if (ctx.getBool('DisableUac', false)) {
      specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v EnableLUA /t REG_DWORD /d 0 /f');
    }
    if (ctx.getBool('EnableLongPaths', false)) {
      specializeScript.append('reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f');
    }
    if (ctx.getBool('EnableRemoteDesktop', false)) {
      specializeScript.append([
        'netsh.exe advfirewall firewall set rule group="@FirewallAPI.dll,-28752" new enable=Yes;',
        'reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f;'
      ].join('\r\n'));
    }
    if (ctx.getBool('PreventDeviceEncryption', false)) {
      specializeScript.append('reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\BitLocker" /v "PreventDeviceEncryption" /t REG_DWORD /d 1 /f;');
    }

    if (ctx.getBool('MakeEdgeUninstallable', false)) {
      ctx.embedTextFile('MakeEdgeUninstallable.ps1', [
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
    if (ctx.getBool('VBoxGuestAdditions', false)) {
      ctx.embedTextFile('VBoxGuestAdditions.ps1', [
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
    if (ctx.getBool('VMwareTools', false)) {
      ctx.embedTextFile('VMwareTools.ps1', [
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
    if (ctx.getBool('VirtIoGuestTools', false)) {
      ctx.embedTextFile('VirtIoGuestTools.ps1', [
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

    // Taskbar Icons (SetTaskbarIcons)
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

    // Start Pins (SetStartPins)
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
    
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptimizationsModifier: OptimizationsModifier };
}
