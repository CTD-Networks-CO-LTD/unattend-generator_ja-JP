/**
 * Locales modifier matching baseline_unattend_engine.js
 */
function LocalesModifier(context) {
  this.context = context;
}

LocalesModifier.prototype.process = function () {
  var ctx = this.context;
  var langMode = ctx.getVal('LanguageMode', 'Unattended');
  var uiLang = ctx.getVal('UILanguage', 'en-US');
  var locale = ctx.getVal('Locale', 'en-US');
  var keyboard = ctx.getVal('Keyboard', '00000409');
  var geoLoc = ctx.getVal('GeoLocation', '244');
  var isJapaneseKeyboard = (keyboard === '00000411' || keyboard.indexOf('0411:') === 0 || locale === 'ja-JP' || uiLang === 'ja-JP');

  ctx.langMode = langMode;
  ctx.uiLang = uiLang;
  ctx.locale = locale;
  ctx.keyboard = keyboard;
  ctx.geoLoc = geoLoc;
  ctx.isJapaneseKeyboard = isJapaneseKeyboard;

  if (isJapaneseKeyboard) {
    ctx.sequences.specialize.append([
      "$regPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\i8042prt\\Parameters';",
      "if (!(Test-Path $regPath)) {",
      "    New-Item -Path $regPath -Force | Out-Null;",
      "}",
      "Set-ItemProperty -Path $regPath -Name 'LayerDriver JPN' -Value 'kbd106.dll' -Type String -Force;",
      "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardIdentifier' -Value 'PCAT_106KEY' -Type String -Force;",
      "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardSubtype' -Value 2 -Type DWord -Force;",
      "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardType' -Value 7 -Type DWord -Force;"
    ].join('\r\n'));

    ctx.sequences.firstLogon.append([
      "$regPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Services\\i8042prt\\Parameters';",
      "if (!(Test-Path $regPath)) {",
      "    New-Item -Path $regPath -Force | Out-Null;",
      "}",
      "Set-ItemProperty -Path $regPath -Name 'LayerDriver JPN' -Value 'kbd106.dll' -Type String -Force;",
      "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardIdentifier' -Value 'PCAT_106KEY' -Type String -Force;",
      "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardSubtype' -Value 2 -Type DWord -Force;",
      "Set-ItemProperty -Path $regPath -Name 'OverrideKeyboardType' -Value 7 -Type DWord -Force;",
      "try {",
      "    $langList = New-WinUserLanguageList -Language 'ja-JP';",
      "    Set-WinUserLanguageList -LanguageList $langList -Force;",
      "    Copy-UserInternationalSettingsToSystem -WelcomeScreen $true -NewUser $true;",
      "} catch {}"
    ].join('\r\n'));
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LocalesModifier: LocalesModifier };
}
