/**
 * Disk modifier matching C# DiskModifier & baseline_unattend_engine.js
 * Handles WinPE stage scripts (PEScript, DiskpartScript, TargetDiskScript)
 */

function escapeBatchLine(line) {
  return line
    .replace(/\^/g, '^^')
    .replace(/&/g, '^&')
    .replace(/\|/g, '^|')
    .replace(/</g, '^<')
    .replace(/>/g, '^>')
    .replace(/\(/g, '^(')
    .replace(/\)/g, '^)');
}

function processEchoLines(lines, escape) {
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (escape) {
      line = escapeBatchLine(line);
    }
    result.push('echo:' + line);
  }
  return result;
}

function writeToFilePE(filePath, lines, escape) {
  var maxLineLength = 255;
  var segments = processEchoLines(lines, escape !== false);
  var result = [];

  while (segments.length > 0) {
    var prev = null;
    var current = null;
    for (var take = 1; take <= segments.length; take++) {
      current = 'cmd.exe /c >>' + filePath + ' (' + segments.slice(0, take).join('&') + ')';
      if (current.length > maxLineLength) {
        if (prev === null) {
          result.push(current);
          segments.splice(0, take);
          break;
        } else {
          result.push(prev);
          segments.splice(0, take - 1);
          break;
        }
      } else {
        prev = current;
        if (take === segments.length) {
          result.push(current);
          segments = [];
          break;
        }
      }
    }
  }

  return result;
}

function DiskModifier(context) {
  this.context = context;
  this.peLines = [];
  this.peScriptCopy = null;
}

DiskModifier.prototype.process = function () {
  var ctx = this.context;
  var peMode = ctx.getVal('PEMode', 'Default');

  if (peMode === 'Default') {
    return;
  }

  var lines = [];

  if (peMode === 'Script') {
    var rawPeScript = ctx.getVal('PEScript', '');
    if (rawPeScript && rawPeScript.trim()) {
      var normalized = rawPeScript.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      lines = normalized.split('\n');
    }
  } else if (peMode === 'Generated') {
    lines.push('@echo off');
    lines.push('');
    lines.push('call :print "Setting keyboard layout for PE session"');
    var lcid = ctx.isJapaneseKeyboard ? '0411:00000411' : (ctx.keyboard || '0409:00000409');
    lines.push('wpeutil.exe SetKeyboardLayout ' + lcid);
    lines.push('');
    lines.push('for %%d in (C D E F G H I J K L M N O P Q T U V X Y Z) do (');
    lines.push('    if exist %%d:\\sources\\install.wim set "IMAGE_FILE=%%d:\\sources\\install.wim"');
    lines.push('    if exist %%d:\\sources\\install.esd set "IMAGE_FILE=%%d:\\sources\\install.esd"');
    lines.push('    if exist %%d:\\sources\\install.swm set "IMAGE_FILE=%%d:\\sources\\install.swm" & set "SWM_PARAM=/SWMFile:%%d:\\sources\\install*.swm"');
    lines.push('    if exist %%d:\\autounattend.xml set "XML_FILE=%%d:\\autounattend.xml"');
    lines.push('    if exist %%d:\\$OEM$ set "OEM_FOLDER=%%d:\\$OEM$"');
    lines.push('    if exist %%d:\\$WinPEDriver$ set "PEDRIVERS_FOLDER=%%d:\\$WinPEDriver$"');
    lines.push(')');
    lines.push('for /f "tokens=3" %%t in (\'reg.exe query HKLM\\System\\Setup /v UnattendFile 2^>nul\') do ( if exist %%t set "XML_FILE=%%t" )');
    lines.push('if not defined IMAGE_FILE call :fail "Could not locate install.wim, install.esd or install.swm."');
    lines.push('if not defined XML_FILE call :fail "Could not locate autounattend.xml."');
    lines.push('');

    // Target Disk handling
    var targetDiskMode = ctx.getVal('TargetDiskMode', 'Auto');
    if (targetDiskMode === 'Script') {
      var rawTargetDiskScript = ctx.getVal('TargetDiskScript', '');
      if (rawTargetDiskScript && rawTargetDiskScript.trim()) {
        var tdNorm = rawTargetDiskScript.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var tdLines = tdNorm.split('\n');
        lines.push('>X:\\target.vbs (');
        var echoTd = processEchoLines(tdLines, true);
        for (var e = 0; e < echoTd.length; e++) {
          lines.push('    ' + echoTd[e]);
        }
        lines.push(')');
        lines.push('');
        lines.push('call :print "Determining target disk"');
        lines.push('(cscript.exe //E:vbscript "X:\\target.vbs" //Nologo >X:\\target.out) || (type X:\\target.out & call :fail "Could not determine target disk. Windows Setup will halt to avoid potential data loss.")');
        lines.push('for /f %%t in (X:\\target.out) do set "TARGET_DISK=%%t"');
        lines.push('');
      }
    } else if (targetDiskMode === 'Interactive') {
      lines.push('echo list disk | diskpart.exe');
      lines.push('echo:');
      lines.push(':choice');
      lines.push('set /p "CHOICE=Enter index of the disk you want to install Windows to: " || goto :choice');
      lines.push('set "TARGET_DISK=%CHOICE%"');
      lines.push('');
    } else {
      lines.push('set "TARGET_DISK=0"');
      lines.push('');
    }

    // Partition handling
    var partitionMode = ctx.getVal('PartitionMode', 'Unattended');
    if (partitionMode === 'Custom') {
      var rawDiskpartScript = ctx.getVal('DiskpartScript', '');
      if (rawDiskpartScript && rawDiskpartScript.trim()) {
        var dpNorm = rawDiskpartScript.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var dpLines = dpNorm.split('\n');
        lines.push('>X:\\diskpart.txt (');
        var echoDp = processEchoLines(dpLines, false);
        for (var d = 0; d < echoDp.length; d++) {
          lines.push('    ' + echoDp[d]);
        }
        lines.push(')');
        lines.push('');
        lines.push('call :print "Configuring partitions"');
        if (ctx.getBool('PauseBeforeFormatting', false)) {
          lines.push('pause');
        }
        lines.push('diskpart.exe /s X:\\diskpart.txt || call :fail "diskpart.exe encountered an error."');
        lines.push('');
      }
    } else {
      lines.push('>X:\\diskpart.txt (');
      lines.push('    echo:SELECT DISK=%TARGET_DISK%');
      lines.push('    echo:CLEAN');
      lines.push('    echo:CONVERT GPT');
      lines.push('    echo:CREATE PARTITION EFI SIZE=300');
      lines.push('    echo:FORMAT QUICK FS=FAT32 LABEL="System"');
      lines.push('    echo:ASSIGN LETTER=S');
      lines.push('    echo:CREATE PARTITION MSR SIZE=16');
      lines.push('    echo:CREATE PARTITION PRIMARY');
      lines.push('    echo:SHRINK MINIMUM=1000');
      lines.push('    echo:FORMAT QUICK FS=NTFS LABEL="Windows"');
      lines.push('    echo:ASSIGN LETTER=W');
      lines.push('    echo:CREATE PARTITION PRIMARY');
      lines.push('    echo:FORMAT QUICK FS=NTFS LABEL="Recovery"');
      lines.push('    echo:ASSIGN LETTER=R');
      lines.push('    echo:SET ID="de94bba4-06d1-4d40-a16a-bfd50179d6ac"');
      lines.push('    echo:GPT ATTRIBUTES=0x8000000000000001');
      lines.push(')');
      lines.push('');
      lines.push('call :print "Configuring partitions"');
      lines.push('diskpart.exe /s X:\\diskpart.txt || call :fail "diskpart.exe encountered an error."');
      lines.push('');
    }

    // Apply Image and Boot setup
    lines.push('call :print "Applying Windows image"');
    var compactParam = ctx.getBool('CompactOs', false) ? ' /Compact' : '';
    lines.push('dism.exe /Apply-Image /ImageFile:%IMAGE_FILE% %SWM_PARAM% /Index:1 /ApplyDir:W:\\' + compactParam);
    lines.push('');
    lines.push('call :print "Writing boot files"');
    lines.push('W:\\Windows\\System32\\bcdboot.exe W:\\Windows /s S: /f ALL');
    lines.push('');
    lines.push('call :print "Copying unattend.xml"');
    lines.push('mkdir W:\\Windows\\Panther');
    lines.push('copy /y %XML_FILE% W:\\Windows\\Panther\\unattend.xml');
    lines.push('');
    if (ctx.getBool('PauseBeforeReboot', false)) {
      lines.push('pause');
    }
    lines.push('wpeutil.exe Reboot');
    lines.push('');
    lines.push(':print');
    lines.push('echo:=== %~1 ===');
    lines.push('goto :eof');
    lines.push('');
    lines.push(':fail');
    lines.push('echo:ERROR: %~1');
    lines.push('pause');
    lines.push('exit /b 1');
  }

  if (lines.length > 0) {
    this.peLines = lines;
    this.peScriptCopy = lines.join('\r\n');
  }
};

DiskModifier.prototype.applyToWindowsPE = function (peSettingsElem, extensionsElem, arch) {
  if (this.peLines.length === 0) {
    return;
  }

  peSettingsElem.children = [];

  var winSetup = peSettingsElem.addChild(new XmlNode('component', {
    'name': 'Microsoft-Windows-Setup',
    'processorArchitecture': arch,
    'publicKeyToken': '31bf3856ad364e35',
    'language': 'neutral',
    'versionScope': 'nonSxS'
  }));

  var runSync = winSetup.addChild(new XmlNode('RunSynchronous'));
  var writeCmds = writeToFilePE('X:\\pe.cmd', this.peLines);

  var order = 1;
  for (var i = 0; i < writeCmds.length; i++) {
    var cmdElem = runSync.addChild(new XmlNode('RunSynchronousCommand', { 'wcm:action': 'add' }));
    cmdElem.addSimpleElement('Order', String(order++));
    cmdElem.addSimpleElement('Path', writeCmds[i]);
  }

  var execCmd = runSync.addChild(new XmlNode('RunSynchronousCommand', { 'wcm:action': 'add' }));
  execCmd.addSimpleElement('Order', String(order++));
  execCmd.addSimpleElement('Path', 'cmd.exe /c "X:\\pe.cmd"');

  if (extensionsElem && this.peScriptCopy) {
    var peCopyElem = extensionsElem.addChild(new XmlNode('PEScriptCopy'));
    peCopyElem.addChild(new XmlNode(this.peScriptCopy, null, null, true));
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DiskModifier: DiskModifier,
    writeToFilePE: writeToFilePE,
    escapeBatchLine: escapeBatchLine,
    processEchoLines: processEchoLines
  };
}


