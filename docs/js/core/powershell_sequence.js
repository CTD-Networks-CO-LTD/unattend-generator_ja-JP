/**
 * PowerShell sequence builder matching C# PowerShellSequence
 */
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
