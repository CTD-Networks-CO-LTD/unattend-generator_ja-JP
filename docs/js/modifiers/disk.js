/**
 * Disk modifier matching C# modifier/Disk.cs & Main.cs
 * Handles WinPE stage scripts (PEScript, DiskpartScript, TargetDiskScript)
 */

var RESERVED_BATCH_CHARS = ['^', '&', '<', '>', '|', '%', ')', '"'];

var WINDOWS_EDITIONS = {
  'home': 'Home',
  'home_n': 'Home N',
  'home_single': 'Home Single Language',
  'education': 'Education',
  'education_n': 'Education N',
  'pro': 'Pro',
  'pro_n': 'Pro N',
  'pro_education': 'Pro Education',
  'pro_education_n': 'Pro Education N',
  'pro_workstations': 'Pro for Workstations',
  'pro_workstations_n': 'Pro N for Workstations',
  'enterprise': 'Enterprise',
  'enterprise_n': 'Enterprise N'
};

var GEO_LOCATIONS = {
  "244": "United States",
  "122": "Japan",
  "94": "Germany",
  "242": "United Kingdom",
  "84": "France",
  "118": "Italy",
  "217": "Spain",
  "39": "Canada",
  "12": "Australia",
  "45": "China",
  "134": "Korea",
  "203": "Russia",
  "32": "Brazil",
  "113": "India",
  "176": "Netherlands",
  "221": "Sweden",
  "223": "Switzerland",
  "191": "Poland",
  "235": "Türkiye",
  "166": "Mexico"
};

if (typeof require !== 'undefined') {
  try {
    var geoJson = require('../../resource/GeoId.json');
    for (var g = 0; g < geoJson.length; g++) {
      GEO_LOCATIONS[geoJson[g].Id] = geoJson[g].DisplayName;
    }
  } catch (e) {}
}

function escapeBatchLine(line) {
  var sb = '';
  for (var i = 0; i < line.length; i++) {
    var c = line.charAt(i);
    if (RESERVED_BATCH_CHARS.indexOf(c) !== -1) {
      sb += '^';
    }
    sb += c;
  }
  return sb;
}

function processEchoLines(lines, escape) {
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].trim();
    if (trimmed.length > 0) {
      result.push('echo:' + (escape ? escapeBatchLine(trimmed) : trimmed));
    }
  }
  return result;
}

function writeToFilePE(filePath, lines) {
  if (/\s/.test(filePath)) {
    throw new Error("Path '" + filePath + "' must not contain whitespace characters.");
  }
  var maxLineLength = 255;
  var segments = processEchoLines(lines, true);
  var result = [];

  while (segments.length > 0) {
    var prev = null;
    var current = null;
    for (var take = 1; take <= segments.length; take++) {
      current = 'cmd.exe /c >>' + filePath + ' (' + segments.slice(0, take).join('&') + ')';
      if (current.length > maxLineLength) {
        if (prev === null) {
          throw new Error("Line '" + current + "' is too long. You need to add line breaks to your input to make it shorter.");
        } else {
          result.push(prev);
          segments.splice(0, take - 1);
          current = null;
          break;
        }
      } else {
        prev = current;
      }
    }
    if (current !== null) {
      result.push(current);
      break;
    }
  }

  return result;
}

function includeEmbeddedScript(peLines, path, scriptLines, escape) {
  var processed = processEchoLines(scriptLines, escape);
  if (processed.length > 0) {
    peLines.push('>' + path + ' (');
    for (var i = 0; i < processed.length; i++) {
      peLines.push('    ' + processed[i]);
    }
    peLines.push(')');
    peLines.push('');
    return true;
  }
  return false;
}

function checkDriveLetterAssignments(lines) {
  function checkLetter(letter, purpose) {
    var re = new RegExp('^\\s*ASSIGN\\s+LETTER((\\s+)|(\\s*=\\s*))((' + letter + ')|("' + letter + '"))\\s*$', 'i');
    var found = false;
    for (var i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error("Your diskpart script must contain a line such as 'ASSIGN LETTER=" + letter + "' to assign the drive letter '" + letter + ":' to the " + purpose + " partition.");
    }
  }
  checkLetter('W', 'Windows');
  checkLetter('S', 'system');
}

function getTargetDiskScript(ctx) {
  var lines = [];
  lines.push('Function Fail(message)');
  lines.push('  WScript.Echo message');
  lines.push('  WScript.Quit 1');
  lines.push('End Function');
  lines.push('');
  lines.push('On Error Resume Next');
  lines.push('Set wmi = GetObject("winmgmts:\\\\.\\root\\cimv2")');
  lines.push('Set drives = wmi.InstancesOf("Win32_DiskDrive")');
  lines.push('If Err.Number <> 0 Then');
  lines.push('  Fail "Could not enumerate disks: " & Err.Description');
  lines.push('End If');
  lines.push('Set accepted = CreateObject("Scripting.Dictionary")');
  lines.push('');
  lines.push('For Each drive In drives');
  lines.push('  accept = True');
  lines.push('');

  // 1. AssertInterfaceType (TargetDiskInterfaceType checkbox)
  if (ctx.getBool('TargetDiskInterfaceType', false)) {
    lines.push('  actual = drive.InterfaceType');
    lines.push('  If actual <> "IDE" And actual <> "SCSI" Then');
    lines.push('    accept = False');
    lines.push('  End If');
    lines.push('');
  }

  // 2. AssertMediaType (TargetDiskMediaType checkbox)
  if (ctx.getBool('TargetDiskMediaType', false)) {
    lines.push('  actual = drive.MediaType');
    lines.push('  If actual <> "Fixed hard disk media" Then');
    lines.push('    accept = False');
    lines.push('  End If');
    lines.push('');
  }

  // 3. Size check (TargetDiskSize checkbox)
  if (ctx.getBool('TargetDiskSize', false)) {
    var minVal = ctx.getVal('TargetDiskMinSize', '100');
    if (minVal !== '' && minVal !== null && minVal !== undefined) {
      lines.push('  actual = CInt(drive.Size / 1024 / 1024 / 1024)');
      lines.push('  expected = ' + parseInt(minVal, 10));
      lines.push('  If actual < expected Then');
      lines.push('    accept = False');
      lines.push('  End If');
      lines.push('');
    }
    var maxVal = ctx.getVal('TargetDiskMaxSize', '4000');
    if (maxVal !== '' && maxVal !== null && maxVal !== undefined) {
      lines.push('  actual = CInt(drive.Size / 1024 / 1024 / 1024)');
      lines.push('  expected = ' + parseInt(maxVal, 10));
      lines.push('  If actual > expected Then');
      lines.push('    accept = False');
      lines.push('  End If');
      lines.push('');
    }
  }

  // 4. Index check (TargetDiskIndex checkbox)
  if (ctx.getBool('TargetDiskIndex', false)) {
    var idxVal = ctx.getVal('TargetDisk', '0');
    if (idxVal !== '' && idxVal !== null && idxVal !== undefined) {
      lines.push('  actual = drive.Index');
      lines.push('  expected = ' + parseInt(idxVal, 10));
      lines.push('  If actual <> expected Then');
      lines.push('    accept = False');
      lines.push('  End If');
      lines.push('');
    }
  }

  // 5. AssertNoPartitions (TargetDiskNoPartitions checkbox)
  if (ctx.getBool('TargetDiskNoPartitions', false)) {
    lines.push('  actual = drive.Partitions');
    lines.push('  If actual > 0 Then');
    lines.push('    accept = False');
    lines.push('  End If');
    lines.push('');
  }

  lines.push('  If accept Then');
  lines.push('    accepted.Add drive.Index, ""');
  lines.push('  End If');
  lines.push('Next');
  lines.push('');
  lines.push('If accepted.Count = 0 Then');
  lines.push('  Fail "No disk satisfied the given criteria."');
  lines.push('ElseIf accepted.Count > 1 Then');
  lines.push('  Fail "Several disks (" & Join(accepted.Keys, ", ") & ") satisfied the given criteria."');
  lines.push('Else');
  lines.push('  WScript.Echo Join(accepted.Keys)');
  lines.push('  WScript.Quit 0');
  lines.push('End If');

  return lines;
}


function getDiskpartScript(layout, ctx) {
  var targetDiskMode = ctx.getVal('TargetDiskMode', 'Generated');
  var targetDisk = '%TARGET_DISK%';
  if (targetDiskMode !== 'Generated' && targetDiskMode !== 'Script' && targetDiskMode !== 'Interactive') {
    targetDisk = ctx.getVal('TargetDisk', '0');
  }

  var systemSize = parseInt(ctx.getVal('SystemSize', '300'), 10) || 300;
  var recoverySize = parseInt(ctx.getVal('RecoverySize', '1000'), 10) || 1000;
  var recoveryMode = ctx.getVal('RecoveryMode', 'Partition');
  var isRecovery = (recoveryMode === 'Partition');

  var lines = [];
  if (layout === 'MBR') {
    lines.push('SELECT DISK=' + targetDisk);
    lines.push('CLEAN');
    lines.push('CREATE PARTITION PRIMARY SIZE=' + systemSize);
    lines.push('FORMAT QUICK FS=NTFS LABEL="System"');
    lines.push('ASSIGN LETTER=S');
    lines.push('ACTIVE');
    lines.push('CREATE PARTITION PRIMARY');
    if (isRecovery) {
      lines.push('SHRINK MINIMUM=' + recoverySize);
    }
    lines.push('FORMAT QUICK FS=NTFS LABEL="Windows"');
    lines.push('ASSIGN LETTER=W');
    if (isRecovery) {
      lines.push('CREATE PARTITION PRIMARY');
      lines.push('FORMAT QUICK FS=NTFS LABEL="Recovery"');
      lines.push('ASSIGN LETTER=R');
      lines.push('SET ID=27');
    }
  } else if (layout === 'GPT') {
    lines.push('SELECT DISK=' + targetDisk);
    lines.push('CLEAN');
    lines.push('CONVERT GPT');
    lines.push('CREATE PARTITION EFI SIZE=' + systemSize);
    lines.push('FORMAT QUICK FS=FAT32 LABEL="System"');
    lines.push('ASSIGN LETTER=S');
    lines.push('CREATE PARTITION MSR SIZE=16');
    lines.push('CREATE PARTITION PRIMARY');
    if (isRecovery) {
      lines.push('SHRINK MINIMUM=' + recoverySize);
    }
    lines.push('FORMAT QUICK FS=NTFS LABEL="Windows"');
    lines.push('ASSIGN LETTER=W');
    if (isRecovery) {
      lines.push('CREATE PARTITION PRIMARY');
      lines.push('FORMAT QUICK FS=NTFS LABEL="Recovery"');
      lines.push('ASSIGN LETTER=R');
      lines.push('SET ID="de94bba4-06d1-4d40-a16a-bfd50179d6ac"');
      lines.push('GPT ATTRIBUTES=0x8000000000000001');
    }
  }
  return lines;
}


function getPEScript(ctx) {
  var lines = [];

  lines.push('@echo off');
  lines.push('');

  // 1. Keyboard Layout
  var langMode = ctx.getVal('LanguageMode', 'Unattended');
  if (langMode === 'Unattended') {
    lines.push('call :print "Setting keyboard layout for PE session"');
    var lcid = ctx.isJapaneseKeyboard ? '0411:00000411' : (ctx.keyboard || '0409:00000409');
    if (lcid.indexOf(':') === -1 && lcid.length === 8) {
      lcid = lcid.substring(4) + ':' + lcid;
    }
    lines.push('wpeutil.exe SetKeyboardLayout ' + lcid);
    lines.push('');
  }

  // 2. Drive discovery
  lines.push('for %%d in (C D E F G H I J K L M N O P Q T U V X Y Z) do (');
  lines.push('    if exist %%d:\\sources\\install.wim set "IMAGE_FILE=%%d:\\sources\\install.wim"');
  lines.push('    if exist %%d:\\sources\\install.esd set "IMAGE_FILE=%%d:\\sources\\install.esd"');
  lines.push('    if exist %%d:\\sources\\install.swm set "IMAGE_FILE=%%d:\\sources\\install.swm" & set "SWM_PARAM=/SWMFile:%%d:\\sources\\install*.swm"');
  lines.push('    if exist %%d:\\autounattend.xml set "XML_FILE=%%d:\\autounattend.xml"');
  lines.push('    if exist %%d:\\$OEM$ set "OEM_FOLDER=%%d:\\$OEM$"');
  lines.push('    if exist %%d:\\$WinPEDriver$ set "PEDRIVERS_FOLDER=%%d:\\$WinPEDriver$"');
  if (ctx.getBool('VirtIoGuestTools', false)) {
    lines.push('    if exist %%d:\\virtio-win-guest-tools.exe set "VIRTIO_DRIVE=%%d:"');
  }
  lines.push(')');
  lines.push('for /f "tokens=3" %%t in (\'reg.exe query HKLM\\System\\Setup /v UnattendFile 2^>nul\') do ( if exist %%t set "XML_FILE=%%t" )');
  lines.push('if not defined IMAGE_FILE call :fail "Could not locate install.wim, install.esd or install.swm."');
  lines.push('if not defined XML_FILE call :fail "Could not locate autounattend.xml."');
  lines.push('');

  // 3. OS Version
  lines.push('set "OS_VERSION=11"');
  lines.push('for /f "tokens=3 delims=." %%v in (\'ver\') do (');
  lines.push('    if %%v LSS 20000 set "OS_VERSION=10"');
  lines.push(')');
  lines.push('');

  // 4. Drivers
  lines.push('if defined PEDRIVERS_FOLDER (');
  lines.push('    call :print "Loading drivers from $WinPEDriver$ folder"');
  lines.push('    for /r "%PEDRIVERS_FOLDER%" %%s in (*.inf) do (');
  lines.push('        drvload.exe "%%s"');
  lines.push('    )');
  lines.push(')');
  lines.push('');
  if (ctx.getBool('VirtIoGuestTools', false)) {
    lines.push('if defined VIRTIO_DRIVE (');
    lines.push('    call :print "Loading VirtIO drivers"');
    lines.push('    drvload.exe "%VIRTIO_DRIVE%\\vioscsi\\w%OS_VERSION%\\%PROCESSOR_ARCHITECTURE%\\vioscsi.inf"');
    lines.push('    drvload.exe "%VIRTIO_DRIVE%\\viostor\\w%OS_VERSION%\\%PROCESSOR_ARCHITECTURE%\\viostor.inf"');
    lines.push('    drvload.exe "%VIRTIO_DRIVE%\\NetKVM\\w%OS_VERSION%\\%PROCESSOR_ARCHITECTURE%\\netkvm.inf"');
    lines.push(')');
    lines.push('');
  }
  // 5. Target Disk
  var targetDiskMode = ctx.getVal('TargetDiskMode', 'Generated');
  if (targetDiskMode === 'Interactive') {
    lines.push('echo list disk | diskpart.exe');
    lines.push('echo:');
    lines.push(':choice');
    lines.push('set /p "CHOICE=Enter index of the disk you want to install Windows to: " || goto :choice');
    lines.push('set "TARGET_DISK=%CHOICE%"');
    lines.push('');
  } else if (targetDiskMode === 'Script') {
    var rawTd = ctx.getVal('TargetDiskScript', '');
    var tdLines = rawTd ? rawTd.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n') : [];
    includeEmbeddedScript(lines, 'X:\\target.vbs', tdLines, true);
    lines.push('call :print "Determining target disk"');
    lines.push('(cscript.exe //E:vbscript "X:\\target.vbs" //Nologo >X:\\target.out) || (type X:\\target.out & call :fail "Could not determine target disk. Windows Setup will halt to avoid potential data loss.")');
    lines.push('for /f %%t in (X:\\target.out) do set "TARGET_DISK=%%t"');
    lines.push('');
  } else {
    // Generated
    var genTdLines = getTargetDiskScript(ctx);
    includeEmbeddedScript(lines, 'X:\\target.vbs', genTdLines, true);
    lines.push('call :print "Determining target disk"');
    lines.push('(cscript.exe //E:vbscript "X:\\target.vbs" //Nologo >X:\\target.out) || (type X:\\target.out & call :fail "Could not determine target disk. Windows Setup will halt to avoid potential data loss.")');
    lines.push('for /f %%t in (X:\\target.out) do set "TARGET_DISK=%%t"');
    lines.push('');
  }

  // 6. Partitioning
  function executeDiskpart(path, message) {
    lines.push('call :print "' + message + '"');
    if (ctx.getBool('PauseBeforeFormatting', false)) {
      lines.push('pause');
    }
    lines.push('diskpart.exe /s ' + path + ' || call :fail "diskpart.exe encountered an error."');
    lines.push('');
  }

  lines.push('wpeutil.exe UpdateBootInfo');
  lines.push('for /f "tokens=3" %%t in (\'reg.exe query HKLM\\System\\CurrentControlSet\\Control /v PEFirmwareType\') do (');
  lines.push('    if %%t == 0x1 (');
  lines.push('        set "LAYOUT=MBR"');
  lines.push('        set "FIRMWARE=BIOS"');
  lines.push('    ) else if %%t == 0x2 (');
  lines.push('        set "LAYOUT=GPT"');
  lines.push('        set "FIRMWARE=UEFI"');
  lines.push('    ) else (');
  lines.push('        call :fail "Unexpected PEFirmwareType value %%t."');
  lines.push('    )');
  lines.push(')');
  lines.push('call :print "The computer is booted in %FIRMWARE% mode, hence the target disk must be configured with the %LAYOUT% partition layout"');

  var partitionMode = ctx.getVal('PartitionMode', 'Unattended');
  if (partitionMode === 'Custom') {
    var rawDp = ctx.getVal('DiskpartScript', '');
    var dpLines = rawDp ? rawDp.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n') : [];
    checkDriveLetterAssignments(dpLines);
    includeEmbeddedScript(lines, 'X:\\diskpart.txt', dpLines, true);
    executeDiskpart('X:\\diskpart.txt', 'diskpart will now execute your script');
  } else if (partitionMode === 'Interactive') {
    lines.push('call :print ^"Press Shift+F10 to open a new console window, then use diskpart to partition and format the disk manually. Make sure to assign the drive letters W and S ^');
    lines.push('to the Windows and system partitions, respectively. When finished, continue with Windows Setup in this window.^"');
    lines.push('pause');
  } else {
    // Unattended
    var message = 'diskpart will now wipe, partition and format disk %TARGET_DISK%';
    var layout = ctx.getVal('PartitionLayout', 'Automatic');
    if (layout === 'Automatic') {
      var gptScript = getDiskpartScript('GPT', ctx);
      checkDriveLetterAssignments(gptScript);
      includeEmbeddedScript(lines, 'X:\\GPT.txt', gptScript, false);

      var mbrScript = getDiskpartScript('MBR', ctx);
      checkDriveLetterAssignments(mbrScript);
      includeEmbeddedScript(lines, 'X:\\MBR.txt', mbrScript, false);

      executeDiskpart('X:\\%LAYOUT%.txt', message);
    } else {
      var chosenScript = getDiskpartScript(layout, ctx);
      checkDriveLetterAssignments(chosenScript);
      includeEmbeddedScript(lines, 'X:\\diskpart.txt', chosenScript, false);
      executeDiskpart('X:\\diskpart.txt', message);
    }
  }

  // 7. Install From
  var installFromMode = ctx.getVal('InstallFromMode', 'Edition');
  if (installFromMode === 'Index') {
    var idx = ctx.getVal('InstallFromIndex', '1');
    lines.push('set "IMG_PARAM=/Index:' + idx + '"');
  } else if (installFromMode === 'Name') {
    var imgName = ctx.getVal('InstallFromName', 'Windows 11 Pro');
    lines.push('set "IMG_PARAM=/Name:"' + imgName + '""');
  } else if (installFromMode === 'Interactive') {
    lines.push('dism.exe /Get-WimInfo /WimFile:"%IMAGE_FILE%"');
    lines.push('echo:');
    lines.push(':choice');
    lines.push('set /p "CHOICE=Enter index of the image you want to install: " || goto :choice');
    lines.push('set "IMG_PARAM=/Index:%CHOICE%"');
  } else {
    // Edition
    var edKey = ctx.getVal('InstallFromEdition', 'pro');
    var edDisplayName = WINDOWS_EDITIONS[edKey] || 'Pro';
    lines.push('set "IMG_PARAM=/Name:"Windows %OS_VERSION% ' + edDisplayName + '""');
  }

  var compactOs = ctx.getBool('CompactOs', false) ? ' /Compact' : '';
  var skipIntegrity = ctx.getBool('SkipIntegrityCheck', false) ? '' : ' /CheckIntegrity /Verify';
  lines.push('call :print "Applying Windows image to target disk"');
  lines.push('dism.exe /Apply-Image /ImageFile:%IMAGE_FILE% %SWM_PARAM% %IMG_PARAM% /ApplyDir:W:\\' + compactOs + skipIntegrity + ' || call :fail "dism.exe encountered an error."');
  lines.push('');

  // 8. Boot setup
  lines.push('call :print "Making system partition bootable"');
  lines.push('bcdboot.exe W:\\Windows /s S: || call :fail "bcdboot.exe encountered an error."');
  lines.push('if %LAYOUT% == GPT (');
  lines.push('    bcdedit.exe /set {fwbootmgr} bootsequence {bootmgr} || call :fail "bcdedit.exe encountered an error."');
  lines.push(')');
  lines.push('');

  // 9. WinRE removal
  function deleteWinRE() {
    lines.push('call :print "Deleting Windows Recovery Environment (WinRE)"');
    lines.push('del W:\\Windows\\System32\\Recovery\\winre.wim');
    lines.push('');
  }
  if (partitionMode === 'Unattended') {
    if (ctx.getVal('RecoveryMode', 'Partition') === 'None') {
      deleteWinRE();
    }
  } else if (partitionMode === 'Custom') {
    var rawDpLower = (ctx.getVal('DiskpartScript', '') || '').toLowerCase();
    var hasRecId = rawDpLower.indexOf('set id=27') !== -1;
    var hasRecLabel = rawDpLower.indexOf('label="recovery"') !== -1;
    var hasRecGpt = rawDpLower.indexOf('de94bba4-06d1-4d40-a16a-bfd50179d6ac') !== -1;
    if (!hasRecId && !hasRecLabel && !hasRecGpt) {
      deleteWinRE();
    }
  }

  // 10. Copy answer file
  lines.push('call :print "Copying answer file to target disk"');
  lines.push('mkdir W:\\Windows\\Panther');
  lines.push('copy %XML_FILE% W:\\Windows\\Panther\\unattend.xml');
  lines.push('');

  // 11. Inject drivers
  lines.push('if defined PEDRIVERS_FOLDER (');
  lines.push('    call :print "Adding drivers from $WinPEDriver$ folder to new installation"');
  lines.push('    dism.exe /Add-Driver /Image:W:\\ /Driver:"%PEDRIVERS_FOLDER%" /Recurse');
  lines.push(')');
  lines.push('');
  if (ctx.getBool('VirtIoGuestTools', false)) {
    lines.push('if defined VIRTIO_DRIVE (');
    lines.push('    call :print "Adding VirtIO drivers to new installation"');
    lines.push('    dism.exe /Add-Driver /Image:W:\\ /Driver:"%VIRTIO_DRIVE%\\vioscsi\\w%OS_VERSION%\\%PROCESSOR_ARCHITECTURE%\\vioscsi.inf"');
    lines.push('    dism.exe /Add-Driver /Image:W:\\ /Driver:"%VIRTIO_DRIVE%\\viostor\\w%OS_VERSION%\\%PROCESSOR_ARCHITECTURE%\\viostor.inf"');
    lines.push('    dism.exe /Add-Driver /Image:W:\\ /Driver:"%VIRTIO_DRIVE%\\NetKVM\\w%OS_VERSION%\\%PROCESSOR_ARCHITECTURE%\\netkvm.inf"');
    lines.push(')');
    lines.push('');
  }

  // 12. Time Zone
  if (ctx.getVal('TimeZoneMode', 'Implicit') === 'Explicit') {
    var tz = ctx.getVal('TimeZone', '');
    if (tz) {
      lines.push('call :print "Setting time zone"');
      lines.push('dism.exe /Image:W:\\ /Set-TimeZone:"' + tz + '"');
      lines.push('');
    }
  }

  // 13. Disable 8.3 Names
  if (ctx.getBool('Disable8Dot3Names', false)) {
    lines.push('call :print "Disabling 8.3 file names"');
    lines.push('fsutil.exe 8dot3name set W: 1');
    lines.push('fsutil.exe 8dot3name strip /s /f W:\\');
    lines.push('reg.exe LOAD HKLM\\mount W:\\Windows\\System32\\config\\SYSTEM');
    lines.push('reg.exe ADD HKLM\\mount\\ControlSet001\\Control\\FileSystem /v NtfsDisable8dot3NameCreation /t REG_DWORD /d 1 /f');
    lines.push('reg.exe UNLOAD HKLM\\mount');
    lines.push('');
  }

  // 14. Disable Defender
  if (ctx.getBool('DisableDefender', false)) {
    lines.push('call :print "Disabling Windows Defender"');
    lines.push('reg.exe LOAD HKLM\\mount W:\\Windows\\System32\\config\\SYSTEM');
    lines.push('for %%s in (Sense WdBoot WdFilter WdNisDrv WdNisSvc WinDefend) do reg.exe ADD HKLM\\mount\\ControlSet001\\Services\\%%s /v Start /t REG_DWORD /d 4 /f');
    lines.push('reg.exe UNLOAD HKLM\\mount');
    lines.push('');
  }

  // 15. Disable WPBT
  if (ctx.getBool('DisableWpbt', false)) {
    lines.push('call :print "Disabling WPBT"');
    lines.push('reg.exe LOAD HKLM\\mount W:\\Windows\\System32\\config\\SYSTEM');
    lines.push('reg.exe add "HKLM\\mount\\ControlSet001\\Control\\Session Manager" /v DisableWpbtExecution /t REG_DWORD /d 1 /f');
    lines.push('reg.exe UNLOAD HKLM\\mount');
    lines.push('');
  }

  // 16. Paging File
  var pagingMode = ctx.getVal('PagingFileMode', 'Automatic');
  function configurePagingFile(data) {
    lines.push('call :print "Configuring paging file"');
    lines.push('reg.exe LOAD HKLM\\mount W:\\Windows\\System32\\config\\SYSTEM');
    lines.push('reg.exe add "HKLM\\mount\\ControlSet001\\Control\\Session Manager\\Memory Management" /v PagingFiles /t REG_MULTI_SZ /f ' + data);
    lines.push('reg.exe UNLOAD HKLM\\mount');
    lines.push('');
  }
  if (pagingMode === 'None') {
    configurePagingFile('');
  } else if (pagingMode === 'Custom') {
    var initSize = ctx.getVal('InitPagingFileSize', '2000');
    var maxSize = ctx.getVal('MaxPagingFileSize', '4000');
    configurePagingFile('/d "C:\\pagefile.sys ' + initSize + ' ' + maxSize + '"');
  }

  // 17. Device Region (GeoLocation)
  if (langMode === 'Unattended') {
    var geoId = ctx.getVal('GeoLocation', '244');
    var geoName = GEO_LOCATIONS[geoId] || 'United States';
    lines.push('call :print "Setting device setup region to ' + geoName + ' (GeoID ' + geoId + ')"');
    lines.push('reg.exe LOAD HKLM\\mount W:\\Windows\\System32\\config\\SOFTWARE');
    lines.push('reg.exe ADD "HKLM\\mount\\Microsoft\\Windows\\CurrentVersion\\Control Panel\\DeviceRegion" /v DeviceRegion /t REG_DWORD /d ' + geoId + ' /f');
    lines.push('reg.exe UNLOAD HKLM\\mount');
    lines.push('');
  }

  // 18. UseConfigurationSet ($OEM$)
  if (ctx.getBool('UseConfigurationSet', false)) {
    lines.push('set "ROBOCOPY_ARGS=/E /XX /COPY:DAT /DCOPY:DAT /R:0"');
    lines.push('if defined OEM_FOLDER (');
    lines.push('    call :print "Copying contents of $OEM$ folder"');
    lines.push('    if exist "%OEM_FOLDER%\\$$" robocopy.exe "%OEM_FOLDER%\\$$" W:\\Windows %ROBOCOPY_ARGS%');
    lines.push('    if exist "%OEM_FOLDER%\\$1" robocopy.exe "%OEM_FOLDER%\\$1" W:\\ %ROBOCOPY_ARGS%');
    lines.push('    for %%d in (C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (');
    lines.push('        if exist "%OEM_FOLDER%\\%%d" robocopy.exe "%OEM_FOLDER%\\%%d" %%d:\\ %ROBOCOPY_ARGS%');
    lines.push('    )');
    lines.push(')');
    lines.push('');
  }

  // 19. Reboot and subroutines
  lines.push('call :print "Computer will now reboot"');
  if (ctx.getBool('PauseBeforeReboot', false)) {
    lines.push('pause');
  }
  lines.push('wpeutil.exe reboot');
  lines.push('goto :eof');
  lines.push('');
  lines.push(':fail');
  lines.push('echo:');
  lines.push('echo:Fatal error: %~1');
  lines.push('echo:');
  lines.push('pause');
  lines.push('exit 1');
  lines.push('');
  lines.push(':print');
  lines.push('echo:');
  lines.push('echo:*** %~1 ***');
  lines.push('echo:');
  lines.push('goto :eof');

  return lines;
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
    lines = getPEScript(ctx);
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
    processEchoLines: processEchoLines,
    getTargetDiskScript: getTargetDiskScript,
    getDiskpartScript: getDiskpartScript,
    getPEScript: getPEScript
  };
}


