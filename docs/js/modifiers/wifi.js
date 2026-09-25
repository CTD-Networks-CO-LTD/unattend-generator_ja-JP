/**
 * Wifi modifier matching C# WifiModifier & baseline_unattend_engine.js
 * Handles WifiMode === 'FromProfile' and embeds Wifi.xml with WlanSvc wait loop
 */
function WifiModifier(context) {
  this.context = context;
}

WifiModifier.prototype.process = function () {
  var ctx = this.context;
  var wifiMode = ctx.getVal('WifiMode', 'Interactive');
  if (wifiMode !== 'FromProfile') {
    return;
  }

  var rawProfileXml = ctx.getVal('WifiProfileXml', '');
  if (!rawProfileXml || !rawProfileXml.trim()) {
    return;
  }

  var profileXml = rawProfileXml.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
  var xmlFile = ctx.embedTextFile('Wifi.xml', profileXml);

  ctx.sequences.specialize.append([
    "$name = 'WlanSvc';",
    '$start = [datetime]::Now;',
    '$timeout = $start.AddMinutes( 1 );',
    '$params = @{',
    '  Id = 1;',
    '  ParentId = 0;',
    '  Activity = "Waiting for service \'${name}\' to start.";',
    '};',
    'while( $true ) {',
    "\tif( $service = Get-Service -Name $name -ErrorAction 'SilentlyContinue' ) {",
    "\t\tif( $service.Status -eq 'Running' ) {",
    '\t\t\tbreak;',
    '\t\t}',
    '\t}',
    '\tif( [datetime]::Now -gt $timeout ) {',
    '\t\t"Service \'${name}\' did not start in time." | Write-Warning;',
    '\t\tbreak;',
    '\t}',
    '\tWrite-Progress @params -PercentComplete $(',
    '\t\t100 * ( [datetime]::Now - $start ).Ticks / ( $timeout - $start ).Ticks',
    '\t);',
    '\tStart-Sleep -Seconds 5;',
    '}',
    'Write-Progress @params -Completed;'
  ].join('\r\n'));

  ctx.sequences.specialize.append('netsh.exe wlan add profile filename="' + xmlFile + '" user=all;');

  var nameMatch = profileXml.match(/<name>([^<]+)<\/name>/i);
  var profileName = nameMatch ? nameMatch[1].trim() : '';
  var modeMatch = profileXml.match(/<connectionMode>([^<]+)<\/connectionMode>/i);
  var isAuto = modeMatch && modeMatch[1].trim().toLowerCase() === 'auto';

  if (isAuto && profileName) {
    ctx.sequences.specialize.append('netsh.exe wlan connect name="' + profileName + '" ssid="' + profileName + '";');
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WifiModifier: WifiModifier };
}

