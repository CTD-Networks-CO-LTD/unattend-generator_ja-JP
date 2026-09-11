/**
 * Bloatware modifier matching baseline_unattend_engine.js
 */
function BloatwareModifier(context) {
  this.context = context;
}

BloatwareModifier.prototype.process = function () {
  var ctx = this.context;
  var userOnceScript = ctx.sequences.userOnce;
  var defaultUserScript = ctx.sequences.defaultUser;
  var specializeScript = ctx.sequences.specialize;

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
      if (ctx.getBool(item.key, false)) {
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
      ctx.embedTextFile('RemovePackage.ps1', removePkgLines.join('\r\n'));
      specializeScript.invokeFile('C:\\Windows\\Setup\\Scripts\\RemovePackage.ps1');
    }

    if (ctx.getBool('RemoveCopilot', false)) {
      userOnceScript.append("Get-AppxPackage -Name 'Microsoft.Windows.Ai.Copilot.Provider' | Remove-AppxPackage;");
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Policies\\Microsoft\\Windows\\WindowsCopilot" /v TurnOffWindowsCopilot /t REG_DWORD /d 1 /f;');
    }
    if (ctx.getBool('RemoveXboxApps', false)) {
      defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR" /v AppCaptureEnabled /t REG_DWORD /d 0 /f;');
    }
    if (ctx.getBool('RemoveTeams', false)) {
      specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Communications" /v ConfigureChatAutoInstall /t REG_DWORD /d 0 /f;');
    }
    if (ctx.getBool('RemoveOneDrive', false)) {
      specializeScript.append([
        '@(',
        "  'C:\\Users\\Default\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\OneDrive.lnk';",
        "  'C:\\Windows\\System32\\OneDriveSetup.exe';",
        "  'C:\\Windows\\SysWOW64\\OneDriveSetup.exe';",
        ") | Where-Object -FilterScript { [System.IO.File]::Exists( $_ ); } | Remove-Item -Verbose -ErrorAction 'Continue';"
      ].join('\r\n'));
      defaultUserScript.append("Remove-ItemProperty -LiteralPath 'Registry::HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'OneDriveSetup' -Force -ErrorAction 'Continue';");
    }


    
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BloatwareModifier: BloatwareModifier };
}
