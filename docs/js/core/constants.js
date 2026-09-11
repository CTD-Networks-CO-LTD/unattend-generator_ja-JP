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

var COMMIT_HASH = 'f1ce9a9d75259173f0a3f2ef8c84230c731986d9';

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EXTRACT_SCRIPTS_PS1: EXTRACT_SCRIPTS_PS1,
    SET_COMPUTER_NAME_PS1: SET_COMPUTER_NAME_PS1,
    COMMIT_HASH: COMMIT_HASH
  };
}
