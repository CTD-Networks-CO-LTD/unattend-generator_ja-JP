/**
 * Bloatware modifier matching C# Bloatware.cs
 */
var BLOATWARE_DATA = [{"id":"Remove3DViewer","steps":[{"type":"package","selector":"Microsoft.Microsoft3DViewer"}]},{"id":"RemoveBingSearch","steps":[{"type":"package","selector":"Microsoft.BingSearch"}]},{"id":"RemoveCalculator","steps":[{"type":"package","selector":"Microsoft.WindowsCalculator"}]},{"id":"RemoveCamera","steps":[{"type":"package","selector":"Microsoft.WindowsCamera"}]},{"id":"RemoveClipchamp","steps":[{"type":"package","selector":"Clipchamp.Clipchamp"}]},{"id":"RemoveClock","steps":[{"type":"package","selector":"Microsoft.WindowsAlarms"}]},{"id":"RemoveCopilot","steps":[{"type":"package","selector":"Microsoft.Copilot"},{"type":"custom"}]},{"id":"RemoveCortana","steps":[{"type":"package","selector":"Microsoft.549981C3F5F10"}]},{"id":"RemoveDevHome","steps":[{"type":"custom"},{"type":"package","selector":"Microsoft.Windows.DevHome"}]},{"id":"RemoveFamily","steps":[{"type":"package","selector":"MicrosoftCorporationII.MicrosoftFamily"}]},{"id":"RemoveFeedbackHub","steps":[{"type":"package","selector":"Microsoft.WindowsFeedbackHub"}]},{"id":"RemoveGameAssist","steps":[{"type":"package","selector":"Microsoft.Edge.GameAssist"}]},{"id":"RemoveGetHelp","steps":[{"type":"package","selector":"Microsoft.GetHelp"}]},{"id":"RemoveGetStarted","steps":[{"type":"package","selector":"Microsoft.Getstarted"}]},{"id":"RemoveHandwriting","steps":[{"type":"capability","selector":"Language.Handwriting"}]},{"id":"RemoveInternetExplorer","steps":[{"type":"capability","selector":"Browser.InternetExplorer"},{"type":"custom"}]},{"id":"RemoveMailCalendar","steps":[{"type":"package","selector":"microsoft.windowscommunicationsapps"}]},{"id":"RemoveMaps","steps":[{"type":"package","selector":"Microsoft.WindowsMaps"}]},{"id":"RemoveMathInputPanel","steps":[{"type":"capability","selector":"MathRecognizer"}]},{"id":"RemoveMediaFeatures","steps":[{"type":"feature","selector":"MediaPlayback"}]},{"id":"RemoveMixedReality","steps":[{"type":"package","selector":"Microsoft.MixedReality.Portal"}]},{"id":"RemoveNews","steps":[{"type":"package","selector":"Microsoft.BingNews"}]},{"id":"RemoveNotepad","steps":[{"type":"package","selector":"Microsoft.WindowsNotepad"},{"type":"custom"}]},{"id":"RemoveNotepadClassic","steps":[{"type":"capability","selector":"Microsoft.Windows.Notepad"},{"type":"capability","selector":"Microsoft.Windows.Notepad.System"}]},{"id":"RemoveOffice365","steps":[{"type":"package","selector":"Microsoft.MicrosoftOfficeHub"}]},{"id":"RemoveOneDrive","steps":[{"type":"custom"}]},{"id":"RemoveOneNote","steps":[{"type":"package","selector":"Microsoft.Office.OneNote"}]},{"id":"RemoveOneSync","steps":[{"type":"capability","selector":"OneCoreUAP.OneSync"}]},{"id":"RemoveOpenSSHClient","steps":[{"type":"capability","selector":"OpenSSH.Client"}]},{"id":"RemoveOutlook","steps":[{"type":"custom"},{"type":"package","selector":"Microsoft.OutlookForWindows"}]},{"id":"RemovePaint","steps":[{"type":"capability","selector":"Microsoft.Windows.MSPaint"},{"type":"package","selector":"Microsoft.Paint"}]},{"id":"RemovePaint3D","steps":[{"type":"package","selector":"Microsoft.MSPaint"}]},{"id":"RemovePeople","steps":[{"type":"package","selector":"Microsoft.People"}]},{"id":"RemovePhotos","steps":[{"type":"package","selector":"Microsoft.Windows.Photos"}]},{"id":"RemovePowerAutomate","steps":[{"type":"package","selector":"Microsoft.PowerAutomateDesktop"}]},{"id":"RemovePowerShell2","steps":[{"type":"feature","selector":"MicrosoftWindowsPowerShellV2Root"}]},{"id":"RemovePowerShellISE","steps":[{"type":"capability","selector":"Microsoft.Windows.PowerShell.ISE"}]},{"id":"RemoveQuickAssist","steps":[{"type":"capability","selector":"App.Support.QuickAssist"},{"type":"package","selector":"MicrosoftCorporationII.QuickAssist"}]},{"id":"RemoveRdpClient","steps":[{"type":"feature","selector":"Microsoft-RemoteDesktopConnection"}]},{"id":"RemoveRecall","steps":[{"type":"feature","selector":"Recall"}]},{"id":"RemoveSkype","steps":[{"type":"package","selector":"Microsoft.SkypeApp"}]},{"id":"RemoveSnippingTool","steps":[{"type":"package","selector":"Microsoft.ScreenSketch"},{"type":"feature","selector":"Microsoft-SnippingTool"},{"type":"capability","selector":"Microsoft.Windows.SnippingTool"}]},{"id":"RemoveSolitaire","steps":[{"type":"package","selector":"Microsoft.MicrosoftSolitaireCollection"}]},{"id":"RemoveSpeech","steps":[{"type":"capability","selector":"Language.Speech"},{"type":"capability","selector":"Language.TextToSpeech"}]},{"id":"RemoveStepsRecorder","steps":[{"type":"capability","selector":"App.StepsRecorder"}]},{"id":"RemoveStickyNotes","steps":[{"type":"package","selector":"Microsoft.MicrosoftStickyNotes"}]},{"id":"RemoveStore","steps":[{"type":"package","selector":"Microsoft.WindowsStore"},{"type":"package","selector":"Microsoft.StorePurchaseApp"}]},{"id":"RemoveTeams","steps":[{"type":"custom"},{"type":"package","selector":"MicrosoftTeams"},{"type":"package","selector":"MSTeams"}]},{"id":"RemoveToDo","steps":[{"type":"package","selector":"Microsoft.Todos"}]},{"id":"RemoveVoiceRecorder","steps":[{"type":"package","selector":"Microsoft.WindowsSoundRecorder"}]},{"id":"RemoveWallet","steps":[{"type":"package","selector":"Microsoft.Wallet"}]},{"id":"RemoveWeather","steps":[{"type":"package","selector":"Microsoft.BingWeather"}]},{"id":"RemoveWindowsHello","steps":[{"type":"capability","selector":"Hello.Face.18967"},{"type":"capability","selector":"Hello.Face.Migration.18967"},{"type":"capability","selector":"Hello.Face.20134"}]},{"id":"RemoveWindowsMediaPlayer","steps":[{"type":"capability","selector":"Media.WindowsMediaPlayer"}]},{"id":"RemoveWindowsTerminal","steps":[{"type":"package","selector":"Microsoft.WindowsTerminal"}]},{"id":"RemoveWordPad","steps":[{"type":"capability","selector":"Microsoft.Windows.WordPad"}]},{"id":"RemoveXboxApps","steps":[{"type":"package","selector":"Microsoft.Xbox.TCUI"},{"type":"package","selector":"Microsoft.XboxApp"},{"type":"package","selector":"Microsoft.XboxGameOverlay"},{"type":"package","selector":"Microsoft.XboxGamingOverlay"},{"type":"package","selector":"Microsoft.XboxIdentityProvider"},{"type":"package","selector":"Microsoft.XboxSpeechToTextOverlay"},{"type":"package","selector":"Microsoft.GamingApp"},{"type":"custom"}]},{"id":"RemoveYourPhone","steps":[{"type":"package","selector":"Microsoft.YourPhone"}]},{"id":"RemoveZuneMusic","steps":[{"type":"package","selector":"Microsoft.ZuneMusic"}]},{"id":"RemoveZuneVideo","steps":[{"type":"package","selector":"Microsoft.ZuneVideo"}]}];

var REMOVE_BLOATWARE_SCRIPT = '$installed = & $getCommand;\r\nforeach( $selector in $selectors ) {\r\n	$result = [ordered] @{\r\n		Selector = $selector;\r\n	};\r\n	if( $found = $installed | Where-Object -FilterScript $filterCommand ) {\r\n		$result.Output = $found | & $removeCommand;\r\n		if( $? ) {\r\n			$result.Message = "${type} removed.";\r\n		} else {\r\n			$result.Message = "${type} not removed.";\r\n			$result.Error = $Error[0];\r\n		}\r\n	} else {\r\n		$result.Message = "${type} not installed.";\r\n	}\r\n	$result | ConvertTo-Json -Depth 3 -Compress;\r\n}';

function BloatwareModifier(context) {
  this.context = context;
}

BloatwareModifier.prototype.process = function () {
  var ctx = this.context;
  var userOnceScript = ctx.sequences.userOnce;
  var defaultUserScript = ctx.sequences.defaultUser;
  var specializeScript = ctx.sequences.specialize;

  var packageSelectors = [];
  var capabilitySelectors = [];
  var featureSelectors = [];

  for (var i = 0; i < BLOATWARE_DATA.length; i++) {
    var bw = BLOATWARE_DATA[i];
    if (!ctx.getBool(bw.id, false)) {
      continue;
    }
    for (var s = 0; s < bw.steps.length; s++) {
      var step = bw.steps[s];
      if (step.type === 'package') {
        packageSelectors.push(step.selector);
      } else if (step.type === 'capability') {
        capabilitySelectors.push(step.selector);
      } else if (step.type === 'feature') {
        featureSelectors.push(step.selector);
      } else if (step.type === 'custom') {
        if (bw.id === 'RemoveOneDrive') {
          specializeScript.append([
            '@(',
            "  'C:\\Users\\Default\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\OneDrive.lnk';",
            "  'C:\\Windows\\System32\\OneDriveSetup.exe';",
            "  'C:\\Windows\\SysWOW64\\OneDriveSetup.exe';",
            ") | Where-Object -FilterScript { [System.IO.File]::Exists( $_ ); } | Remove-Item -Verbose -ErrorAction 'Continue';"
          ].join('\r\n'));
          defaultUserScript.append("Remove-ItemProperty -LiteralPath 'Registry::HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'OneDriveSetup' -Force -ErrorAction 'Continue';");
        } else if (bw.id === 'RemoveTeams') {
          specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Communications" /v ConfigureChatAutoInstall /t REG_DWORD /d 0 /f;');
        } else if (bw.id === 'RemoveNotepad') {
          specializeScript.append([
            'reg.exe add "HKCR\\.txt\\ShellNew" /v ItemName /t REG_EXPAND_SZ /d "@C:\\Windows\\system32\\notepad.exe,-470" /f;',
            'reg.exe add "HKCR\\.txt\\ShellNew" /v NullFile /t REG_SZ /f;',
            'reg.exe add "HKCR\\txtfilelegacy" /v FriendlyTypeName /t REG_EXPAND_SZ /d "@C:\\Windows\\system32\\notepad.exe,-469" /f;',
            'reg.exe add "HKCR\\txtfilelegacy" /ve /t REG_SZ /d "Text Document" /f;'
          ].join('\r\n'));
          defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Notepad" /v ShowStoreBanner /t REG_DWORD /d 0 /f;');
        } else if (bw.id === 'RemoveOutlook') {
          specializeScript.append("Remove-Item -LiteralPath 'Registry::HKLM\\Software\\Microsoft\\WindowsUpdate\\Orchestrator\\UScheduler_Oobe\\OutlookUpdate' -Force -ErrorAction 'SilentlyContinue';");
        } else if (bw.id === 'RemoveDevHome') {
          specializeScript.append("Remove-Item -LiteralPath 'Registry::HKLM\\Software\\Microsoft\\WindowsUpdate\\Orchestrator\\UScheduler_Oobe\\DevHomeUpdate' -Force -ErrorAction 'SilentlyContinue';");
        } else if (bw.id === 'RemoveCopilot') {
          userOnceScript.append("Get-AppxPackage -Name 'Microsoft.Windows.Ai.Copilot.Provider' | Remove-AppxPackage;");
          defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f;');
        } else if (bw.id === 'RemoveXboxApps') {
          defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f;');
        } else if (bw.id === 'RemoveInternetExplorer') {
          defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Internet Explorer\\LowRegistry\\Audio\\PolicyConfig\\PropertyStore" /f;');
        }
      }
    }
  }

  function buildRemoveScript(selectors, getCmd, filterCmd, removeCmd, type) {
    var lines = ['$selectors = @('];
    for (var k = 0; k < selectors.length; k++) {
      lines.push("\t'" + selectors[k] + "';");
    }
    lines.push(');');
    lines.push('$getCommand = ' + getCmd + ';');
    lines.push('$filterCommand = ' + filterCmd + ';');
    lines.push('$removeCommand = ' + removeCmd + ';');
    lines.push("$type = '" + type + "';");
    return lines.join('\r\n') + '\r\n' + REMOVE_BLOATWARE_SCRIPT;
  }

  if (packageSelectors.length > 0) {
    var pkgGet = ['{', '  Get-AppxProvisionedPackage -Online;', '}'].join('\r\n');
    var pkgFilter = ['{', '  $_.DisplayName -eq $selector;', '}'].join('\r\n');
    var pkgRemove = [
      '{',
      '  [CmdletBinding()]',
      '  param(',
      '    [Parameter( Mandatory, ValueFromPipeline )]',
      '    $InputObject',
      '  );',
      '  process {',
      "    $InputObject | Remove-AppxProvisionedPackage -AllUsers -Online -ErrorAction 'Continue';",
      '  }',
      '}'
    ].join('\r\n');
    var pkgScript = buildRemoveScript(packageSelectors, pkgGet, pkgFilter, pkgRemove, 'Package');
    ctx.embedTextFile('RemovePackage.ps1', pkgScript);
    specializeScript.invokeFile('C:\\Windows\\Setup\\Scripts\\RemovePackage.ps1');
  }

  if (capabilitySelectors.length > 0) {
    var capGet = [
      '{',
      '  Get-WindowsCapability -Online | Where-Object -Property \'State\' -NotIn -Value @(',
      "    'NotPresent';",
      "    'Removed';",
      '  );',
      '}'
    ].join('\r\n');
    var capFilter = ['{', "  ($_.Name -split '~')[0] -eq $selector;", '}'].join('\r\n');
    var capRemove = [
      '{',
      '  [CmdletBinding()]',
      '  param(',
      '    [Parameter( Mandatory, ValueFromPipeline )]',
      '    $InputObject',
      '  );',
      '  process {',
      "    $InputObject | Remove-WindowsCapability -Online -ErrorAction 'Continue';",
      '  }',
      '}'
    ].join('\r\n');
    var capScript = buildRemoveScript(capabilitySelectors, capGet, capFilter, capRemove, 'Capability');
    ctx.embedTextFile('RemoveCapability.ps1', capScript);
    specializeScript.invokeFile('C:\\Windows\\Setup\\Scripts\\RemoveCapability.ps1');
  }

  if (featureSelectors.length > 0) {
    var featGet = [
      '{',
      '  Get-WindowsOptionalFeature -Online | Where-Object -Property \'State\' -NotIn -Value @(',
      "    'Disabled';",
      "    'DisabledWithPayloadRemoved';",
      '  );',
      '}'
    ].join('\r\n');
    var featFilter = ['{', '  $_.FeatureName -eq $selector;', '}'].join('\r\n');
    var featRemove = [
      '{',
      '  [CmdletBinding()]',
      '  param(',
      '    [Parameter( Mandatory, ValueFromPipeline )]',
      '    $InputObject',
      '  );',
      '  process {',
      "    $InputObject | Disable-WindowsOptionalFeature -Online -Remove -NoRestart -ErrorAction 'Continue';",
      '  }',
      '}'
    ].join('\r\n');
    var featScript = buildRemoveScript(featureSelectors, featGet, featFilter, featRemove, 'Feature');
    ctx.embedTextFile('RemoveFeature.ps1', featScript);
    specializeScript.invokeFile('C:\\Windows\\Setup\\Scripts\\RemoveFeature.ps1');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BloatwareModifier: BloatwareModifier };
}
