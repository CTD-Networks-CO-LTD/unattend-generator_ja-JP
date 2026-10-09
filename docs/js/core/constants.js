/**
 * Shared constants and script templates matching baseline_unattend_engine.js
 */

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

var SET_START_PINS_PS1 = [
  'if( [System.Environment]::OSVersion.Version.Build -lt 20000 ) {',
  '\treturn;',
  '}',
  "$key = 'Registry::HKLM\\SOFTWARE\\Microsoft\\PolicyManager\\current\\device\\Start';",
  "New-Item -Path $key -ItemType 'Directory' -ErrorAction 'SilentlyContinue';",
  "Set-ItemProperty -LiteralPath $key -Name 'ConfigureStartPins' -Value $json -Type 'String';"
].join('\r\n');

var UNLOCK_START_LAYOUT_VBS = [
  'HKU = &H80000003',
  'Set reg = GetObject("winmgmts://./root/default:StdRegProv")',
  'Set fso = CreateObject("Scripting.FileSystemObject")',
  '',
  'If reg.EnumKey(HKU, "", sids) = 0 Then',
  '\tIf Not IsNull(sids) Then',
  '\t\tFor Each sid In sids',
  '\t\t\tkey = sid + "\\Software\\Policies\\Microsoft\\Windows\\Explorer"',
  '\t\t\tname = "LockedStartLayout"',
  '\t\t\tIf reg.GetDWORDValue(HKU, key, name, existing) = 0 Then',
  '\t\t\t\treg.SetDWORDValue HKU, key, name, 0',
  '\t\t\tEnd If',
  '\t\tNext',
  '\tEnd If',
  'End If'
].join('\r\n');

var UNLOCK_START_LAYOUT_XML = [
  '<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">',
  '\t<Triggers>',
  '\t\t<EventTrigger>',
  '\t\t\t<Enabled>true</Enabled>',
  '\t\t\t<Subscription>&lt;QueryList&gt;&lt;Query Id="0" Path="Application"&gt;&lt;Select Path="Application"&gt;*[System[Provider[@Name=\'UnattendGenerator\'] and EventID=1]]&lt;/Select&gt;&lt;/Query&gt;&lt;/QueryList&gt;</Subscription>',
  '\t\t</EventTrigger>',
  '\t</Triggers>',
  '\t<Principals>',
  '\t\t<Principal id="Author">',
  '\t\t\t<UserId>S-1-5-18</UserId>',
  '\t\t\t<RunLevel>LeastPrivilege</RunLevel>',
  '\t\t</Principal>',
  '\t</Principals>',
  '\t<Settings>',
  '\t\t<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>',
  '\t\t<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>',
  '\t\t<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>',
  '\t\t<AllowHardTerminate>true</AllowHardTerminate>',
  '\t\t<StartWhenAvailable>false</StartWhenAvailable>',
  '\t\t<RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>',
  '\t\t<IdleSettings>',
  '\t\t\t<StopOnIdleEnd>true</StopOnIdleEnd>',
  '\t\t\t<RestartOnIdle>false</RestartOnIdle>',
  '\t\t</IdleSettings>',
  '\t\t<AllowStartOnDemand>true</AllowStartOnDemand>',
  '\t\t<Enabled>true</Enabled>',
  '\t\t<Hidden>false</Hidden>',
  '\t\t<RunOnlyIfIdle>false</RunOnlyIfIdle>',
  '\t\t<WakeToRun>false</WakeToRun>',
  '\t\t<ExecutionTimeLimit>PT72H</ExecutionTimeLimit>',
  '\t\t<Priority>7</Priority>',
  '\t</Settings>',
  '\t<Actions Context="Author">',
  '\t\t<Exec>',
  '\t\t\t<Command>C:\\Windows\\System32\\wscript.exe</Command>',
  '\t\t\t<Arguments>C:\\Windows\\Setup\\Scripts\\UnlockStartLayout.vbs</Arguments>',
  '\t\t</Exec>',
  '\t</Actions>',
  '</Task>'
].join('\r\n');

var SET_WALLPAPER_PS1 = [
  "Add-Type -TypeDefinition '",
  '\tusing System.Drawing;',
  '\tusing System.Runtime.InteropServices;',
  '\t',
  '\tpublic static class WallpaperSetter {',
  '\t\t[DllImport("user32.dll")]',
  '\t\tprivate static extern bool SetSysColors(',
  '\t\t\tint cElements, ',
  '\t\t\tint[] lpaElements,',
  '\t\t\tint[] lpaRgbValues',
  '\t\t);',
  '',
  '\t\t[DllImport("user32.dll")]',
  '\t\tprivate static extern bool SystemParametersInfo(',
  '\t\t\tuint uiAction,',
  '\t\t\tuint uiParam,',
  '\t\t\tstring pvParam,',
  '\t\t\tuint fWinIni',
  '\t\t);',
  '',
  '\t\tpublic static void SetDesktopBackground(Color color) {',
  '\t\t\tSystemParametersInfo(20, 0, "", 0);',
  '\t\t\tSetSysColors(1, new int[] { 1 }, new int[] { ColorTranslator.ToWin32(color) });',
  '\t\t}',
  '',
  '\t\tpublic static void SetDesktopImage(string file) {',
  '\t\t\tSystemParametersInfo(20, 0, file, 0);',
  '\t\t}',
  '\t}',
  "' -ReferencedAssemblies 'System.Drawing';",
  '',
  'function Set-WallpaperColor {',
  '\tparam(',
  '\t\t[string]',
  '\t\t$HtmlColor',
  '\t);',
  '',
  '\t$color = [System.Drawing.ColorTranslator]::FromHtml( $HtmlColor );',
  '\t[WallpaperSetter]::SetDesktopBackground( $color );',
  "\tSet-ItemProperty -Path 'Registry::HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Wallpapers' -Name 'BackgroundType' -Type 'DWord' -Value 1 -Force;",
  "\tSet-ItemProperty -Path 'Registry::HKCU\\Control Panel\\Desktop' -Name 'WallPaper' -Type 'String' -Value '' -Force;",
  '\tSet-ItemProperty -Path \'Registry::HKCU\\Control Panel\\Colors\' -Name \'Background\' -Type \'String\' -Value "$($color.R) $($color.G) $($color.B)" -Force;',
  '}',
  '',
  'function Set-WallpaperImage {',
  '\tparam(',
  '\t\t[string]',
  '\t\t$LiteralPath',
  '\t);',
  '',
  '\tif( $LiteralPath | Test-Path ) {',
  '\t\t[WallpaperSetter]::SetDesktopImage( $LiteralPath );',
  "\t\tSet-ItemProperty -Path 'Registry::HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Wallpapers' -Name 'BackgroundType' -Type 'DWord' -Value 0 -Force;",
  "\t\tSet-ItemProperty -Path 'Registry::HKCU\\Control Panel\\Desktop' -Name 'WallPaper' -Type 'String' -Value $LiteralPath -Force;",
  '\t} else {',
  '\t\t"Cannot use \'$LiteralPath\' as a desktop wallpaper because that file does not exist.";',
  '\t}',
  '}'
].join('\r\n');

var REPO_URL = 'https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP';
var COMMIT_URL_BASE = REPO_URL + '/commit/';
var COMMIT_HASH = 'ab617e7135649fc6e221a5d016acb760fe90d0a6';
var RELEASE_TAG = 'v1.6.1_20261001';
var RELEASE_URL = 'https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP/releases/tag/v1.6.1_20261001';
var COMMIT_DATE = '2026-10-10T06:09:40+09:00';


var PAUSE_WINDOWS_UPDATE_XML = "<Task version=\"1.2\" xmlns=\"http://schemas.microsoft.com/windows/2004/02/mit/task\">\n\t<Triggers>\n\t\t<BootTrigger>\n\t\t\t<Repetition>\n\t\t\t\t<Interval>P1D</Interval>\n\t\t\t\t<StopAtDurationEnd>false</StopAtDurationEnd>\n\t\t\t</Repetition>\n\t\t\t<Enabled>true</Enabled>\n\t\t</BootTrigger>\n\t</Triggers>\n\t<Principals>\n\t\t<Principal id=\"Author\">\n\t\t\t<UserId>S-1-5-19</UserId>\n\t\t\t<RunLevel>LeastPrivilege</RunLevel>\n\t\t</Principal>\n\t</Principals>\n\t<Settings>\n\t\t<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>\n\t\t<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>\n\t\t<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>\n\t\t<AllowHardTerminate>true</AllowHardTerminate>\n\t\t<StartWhenAvailable>false</StartWhenAvailable>\n\t\t<RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>\n\t\t<IdleSettings>\n\t\t\t<StopOnIdleEnd>true</StopOnIdleEnd>\n\t\t\t<RestartOnIdle>false</RestartOnIdle>\n\t\t</IdleSettings>\n\t\t<AllowStartOnDemand>true</AllowStartOnDemand>\n\t\t<Enabled>true</Enabled>\n\t\t<Hidden>false</Hidden>\n\t\t<RunOnlyIfIdle>false</RunOnlyIfIdle>\n\t\t<WakeToRun>false</WakeToRun>\n\t\t<ExecutionTimeLimit>PT72H</ExecutionTimeLimit>\n\t\t<Priority>7</Priority>\n\t</Settings>\n\t<Actions Context=\"Author\">\n\t\t<Exec>\n\t\t\t<Command>C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe</Command>\n\t\t\t<Arguments>-WindowStyle Hidden -NoProfile -NonInteractive -Command \"$format = 'yyyy-MM-ddTHH\\:mm\\:ssK'; $now = [datetime]::UtcNow; $start = $now.ToString($format); $end = $now.AddDays(7).ToString($format); $params = @{ LiteralPath = 'Registry::HKLM\\Software\\Microsoft\\WindowsUpdate\\UX\\Settings'; Type = 'String'; Force = $true; Verbose = $true; }; 'PauseFeatureUpdatesStartTime', 'PauseQualityUpdatesStartTime', 'PauseUpdatesStartTime' | foreach { Set-ItemProperty @params -Name $_ -Value $start; }; 'PauseFeatureUpdatesEndTime', 'PauseQualityUpdatesEndTime', 'PauseUpdatesExpiryTime' | foreach { Set-ItemProperty @params -Name $_ -Value $end; };\"</Arguments>\n\t\t</Exec>\n\t</Actions>\n</Task>";
var MOVE_ACTIVE_HOURS_XML = "<Task version=\"1.2\" xmlns=\"http://schemas.microsoft.com/windows/2004/02/mit/task\">\n\t<Triggers>\n\t\t<BootTrigger>\n\t\t\t<Repetition>\n\t\t\t\t<Interval>PT4H</Interval>\n\t\t\t\t<StopAtDurationEnd>false</StopAtDurationEnd>\n\t\t\t</Repetition>\n\t\t\t<Enabled>true</Enabled>\n\t\t</BootTrigger>\n\t\t<RegistrationTrigger>\n\t\t\t<Repetition>\n\t\t\t\t<Interval>PT4H</Interval>\n\t\t\t\t<StopAtDurationEnd>false</StopAtDurationEnd>\n\t\t\t</Repetition>\n\t\t\t<Enabled>true</Enabled>\n\t\t</RegistrationTrigger>\n\t</Triggers>\n\t<Principals>\n\t\t<Principal id=\"Author\">\n\t\t\t<UserId>S-1-5-19</UserId>\n\t\t\t<RunLevel>LeastPrivilege</RunLevel>\n\t\t</Principal>\n\t</Principals>\n\t<Settings>\n\t\t<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>\n\t\t<DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>\n\t\t<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>\n\t\t<AllowHardTerminate>true</AllowHardTerminate>\n\t\t<StartWhenAvailable>false</StartWhenAvailable>\n\t\t<RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>\n\t\t<IdleSettings>\n\t\t\t<StopOnIdleEnd>true</StopOnIdleEnd>\n\t\t\t<RestartOnIdle>false</RestartOnIdle>\n\t\t</IdleSettings>\n\t\t<AllowStartOnDemand>true</AllowStartOnDemand>\n\t\t<Enabled>true</Enabled>\n\t\t<Hidden>false</Hidden>\n\t\t<RunOnlyIfIdle>false</RunOnlyIfIdle>\n\t\t<WakeToRun>false</WakeToRun>\n\t\t<ExecutionTimeLimit>PT72H</ExecutionTimeLimit>\n\t\t<Priority>7</Priority>\n\t</Settings>\n\t<Actions Context=\"Author\">\n\t\t<Exec>\n\t\t\t<Command>%windir%\\System32\\conhost.exe</Command>\n\t\t\t<Arguments>--headless %windir%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -WindowStyle Hidden -NoProfile -NonInteractive -Command \"$p = @{ LiteralPath = 'Registry::HKLM\\Software\\Microsoft\\WindowsUpdate\\UX\\Settings'; Type = 'DWord'; }; $h = [datetime]::Now.Hour; Set-ItemProperty @p -Name 'ActiveHoursStart' -Value (($h + 23) % 24); Set-ItemProperty @p -Name 'ActiveHoursEnd' -Value (($h + 11) % 24); Set-ItemProperty @p -Name 'SmartActiveHoursState' -Value 0;\"</Arguments>\n\t\t</Exec>\n\t</Actions>\n</Task>";
var SET_COLOR_THEME_PS1 = "& {\n\t$params = @{\n\t\tLiteralPath = 'Registry::HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize';\n\t\tForce = $true;\n\t\tType = 'DWord';\n\t};\n\tSet-ItemProperty @params -Name 'SystemUsesLightTheme' -Value $lightThemeSystem;\n\tSet-ItemProperty @params -Name 'AppsUseLightTheme' -Value $lightThemeApps;\n\tSet-ItemProperty @params -Name 'ColorPrevalence' -Value $accentColorOnStart;\n\tSet-ItemProperty @params -Name 'EnableTransparency' -Value $enableTransparency;\n};\n& {\n\tAdd-Type -AssemblyName 'System.Drawing';\n\t$accentColor = [System.Drawing.ColorTranslator]::FromHtml( $htmlAccentColor );\n\n\tfunction ConvertTo-DWord {\n\t\tparam(\n\t\t\t[System.Drawing.Color]\n\t\t\t$Color\n\t\t);\n\t\t\t\t\t\t\n\t\t[byte[]] $bytes = @(\n\t\t\t$Color.R;\n\t\t\t$Color.G;\n\t\t\t$Color.B;\n\t\t\t$Color.A;\n\t\t);\n\t\treturn [System.BitConverter]::ToUInt32( $bytes, 0); \n\t}\n\n\t$startColor = [System.Drawing.Color]::FromArgb( 0xD2, $accentColor );\n\tSet-ItemProperty -LiteralPath 'Registry::HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent' -Name 'StartColorMenu' -Value( ConvertTo-DWord -Color $accentColor ) -Type 'DWord' -Force;\n\tSet-ItemProperty -LiteralPath 'Registry::HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent' -Name 'AccentColorMenu' -Value( ConvertTo-DWord -Color $accentColor ) -Type 'DWord' -Force;\n\tSet-ItemProperty -LiteralPath 'Registry::HKCU\\Software\\Microsoft\\Windows\\DWM' -Name 'AccentColor' -Value( ConvertTo-DWord -Color $accentColor ) -Type 'DWord' -Force;\n\t$params = @{\n\t\tLiteralPath = 'Registry::HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent';\n\t\tName = 'AccentPalette';\n\t};\n\t$palette = Get-ItemPropertyValue @params;\n\t$index = 20;\n\t$palette[ $index++ ] = $accentColor.R;\n\t$palette[ $index++ ] = $accentColor.G;\n\t$palette[ $index++ ] = $accentColor.B;\n\t$palette[ $index++ ] = $accentColor.A;\n\tSet-ItemProperty @params -Value $palette -Type 'Binary' -Force;\n};";

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PAUSE_WINDOWS_UPDATE_XML: PAUSE_WINDOWS_UPDATE_XML,
    MOVE_ACTIVE_HOURS_XML: MOVE_ACTIVE_HOURS_XML,
    SET_COLOR_THEME_PS1: SET_COLOR_THEME_PS1,
    EXTRACT_SCRIPTS_PS1: EXTRACT_SCRIPTS_PS1,
    SET_COMPUTER_NAME_PS1: SET_COMPUTER_NAME_PS1,
    SET_START_PINS_PS1: SET_START_PINS_PS1,
    UNLOCK_START_LAYOUT_VBS: UNLOCK_START_LAYOUT_VBS,
    UNLOCK_START_LAYOUT_XML: UNLOCK_START_LAYOUT_XML,
    SET_WALLPAPER_PS1: SET_WALLPAPER_PS1,
    REPO_URL: REPO_URL,
    COMMIT_URL_BASE: COMMIT_URL_BASE,
    COMMIT_HASH: COMMIT_HASH,
    RELEASE_TAG: RELEASE_TAG,
    RELEASE_URL: RELEASE_URL,
    COMMIT_DATE: COMMIT_DATE
  };
}
