/**
 * unattend-generator Client-side XML Engine & Test Tool
 */
(function () {
  'use strict';

  function createIsoBlob(filename, fileContentStr) {
    const SECTOR_SIZE = 2048;
    const encoder = new TextEncoder();
    const fileBytes = encoder.encode(fileContentStr);
    const fileSectors = Math.ceil(fileBytes.length / SECTOR_SIZE) || 1;
    const totalSectors = 16 + 1 + 1 + fileSectors + 1;
    const buffer = new Uint8Array(totalSectors * SECTOR_SIZE);

    const pvdOffset = 16 * SECTOR_SIZE;
    buffer[pvdOffset + 0] = 1;
    buffer.set(encoder.encode('CD001'), pvdOffset + 1);
    buffer[pvdOffset + 6] = 1;
    buffer.set(encoder.encode('WINDOWS                         '.substring(0, 32)), pvdOffset + 8);
    buffer.set(encoder.encode('UNATTEND                        '.substring(0, 32)), pvdOffset + 40);

    const rootDirOffset = pvdOffset + 156;
    buffer[rootDirOffset + 0] = 34;
    buffer[rootDirOffset + 2] = 18;
    buffer[rootDirOffset + 6] = 18;
    buffer[rootDirOffset + 10] = 2048 & 0xff;
    buffer[rootDirOffset + 11] = (2048 >> 8) & 0xff;
    buffer[rootDirOffset + 25] = 2;

    const termOffset = 17 * SECTOR_SIZE;
    buffer[termOffset + 0] = 255;
    buffer.set(encoder.encode('CD001'), termOffset + 1);
    buffer[termOffset + 6] = 1;

    const fileSector = 19;
    buffer.set(fileBytes, fileSector * SECTOR_SIZE);

    let ptr = 18 * SECTOR_SIZE;
    buffer[ptr + 0] = 34; buffer[ptr + 2] = 18; buffer[ptr + 10] = 2048 & 0xff; buffer[ptr + 25] = 2; buffer[ptr + 32] = 1; buffer[ptr + 33] = 0;
    ptr += 34;
    buffer[ptr + 0] = 34; buffer[ptr + 2] = 18; buffer[ptr + 10] = 2048 & 0xff; buffer[ptr + 25] = 2; buffer[ptr + 32] = 1; buffer[ptr + 33] = 1;
    ptr += 34;

    const isoName = (filename + ';1').toUpperCase();
    const recLen = 33 + isoName.length + (isoName.length % 2 === 0 ? 1 : 0);
    buffer[ptr + 0] = recLen;
    buffer[ptr + 2] = fileSector & 0xff;
    buffer[ptr + 3] = (fileSector >> 8) & 0xff;
    buffer[ptr + 10] = fileBytes.length & 0xff;
    buffer[ptr + 11] = (fileBytes.length >> 8) & 0xff;
    buffer[ptr + 25] = 0;
    buffer[ptr + 32] = isoName.length;
    buffer.set(encoder.encode(isoName), ptr + 33);

    return new Blob([buffer], { type: 'application/x-iso9660-image' });
  }

  // フォームデータから autounattend.xml を動的に生成するジェネレータ
  // docs/unattend_engine.js の generateAutounattendXml を優先利用して同期する
  function generateAutounattendXml(formData) {
    if (typeof window !== 'undefined' && window.unattendEngine && typeof window.unattendEngine.generateAutounattendXml === 'function') {
      return window.unattendEngine.generateAutounattendXml(formData);
    }
    if (typeof globalThis !== 'undefined' && globalThis.generateAutounattendXml) {
      return globalThis.generateAutounattendXml(formData);
    }
    try {
      const engine = require('../docs/unattend_engine.js');
      if (engine && typeof engine.generateAutounattendXml === 'function') {
        return engine.generateAutounattendXml(formData);
      }
    } catch (e) {
      // fallback
    }

    const locale = formData.get('Locale') || 'en-US';
    const keyboard = formData.get('Keyboard') || '00000409';
    const geoLoc = formData.get('GeoLocation') || '244';
    const compName = formData.get('ComputerName') || 'Windows';
    const compNameMode = formData.get('ComputerNameMode') || 'Random';
    const timeZone = formData.get('TimeZone') || 'Tokyo Standard Time';

    const accounts = [];
    for (let i = 0; i < 10; i++) {
      const accName = formData.get(`AccountName${i}`);
      if (accName) {
        accounts.push({
          name: accName,
          displayName: formData.get(`AccountDisplayName${i}`) || accName,
          group: formData.get(`AccountGroup${i}`) || 'Administrators',
          password: formData.get(`AccountPassword${i}`) || ''
        });
      }
    }
    if (accounts.length === 0 && formData.get('LocalUser') === 'true') {
      accounts.push({ name: 'Example', displayName: 'Example User', group: 'Administrators', password: '' });
    }

    const isJapanese = (keyboard === '00000411' || keyboard.startsWith('0411:') || locale === 'ja-JP');
    const inputLocStr = (keyboard.indexOf('{') === -1 && keyboard.length === 8) ? `${keyboard.substring(4)}:${keyboard}` : keyboard;

    const xmlLines = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<unattend xmlns="urn:schemas-microsoft-com:unattend" xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">',
      '  <settings pass="windowsPE">',
      '    <component name="Microsoft-Windows-International-Core-WinPE" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">'
    ];

    if (isJapanese) {
      xmlLines.push(
        `      <InputLocale>${inputLocStr}</InputLocale>`,
        `      <SystemLocale>${locale}</SystemLocale>`,
        `      <UILanguage>${locale}</UILanguage>`,
        `      <UserLocale>${locale}</UserLocale>`,
        '      <LayeredDriver>1</LayeredDriver>'
      );
    } else {
      xmlLines.push(
        `      <SetupUILanguage><UILanguage>${locale}</UILanguage></SetupUILanguage>`,
        `      <InputLocale>${inputLocStr}</InputLocale>`,
        `      <SystemLocale>${locale}</SystemLocale>`,
        `      <UILanguage>${locale}</UILanguage>`,
        `      <UserLocale>${locale}</UserLocale>`
      );
    }

    xmlLines.push(
      '    </component>',
      '    <component name="Microsoft-Windows-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">',
      '      <UserData>',
      '        <AcceptEula>true</AcceptEula>',
      '      </UserData>',
      '    </component>',
      '  </settings>',
      '  <settings pass="specialize">',
      '    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">',
      compNameMode === 'Custom' ? `      <ComputerName>${compName}</ComputerName>` : '      <ComputerName>*</ComputerName>',
      `      <TimeZone>${timeZone}</TimeZone>`,
      '    </component>',
      '  </settings>',
      '  <settings pass="oobeSystem">',
      '    <component name="Microsoft-Windows-International-Core" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">',
      `      <InputLocale>${inputLocStr}</InputLocale>`,
      `      <SystemLocale>${locale}</SystemLocale>`,
      `      <UILanguage>${locale}</UILanguage>`,
      `      <UserLocale>${locale}</UserLocale>`,
      `      <GeoLocation>${geoLoc}</GeoLocation>`,
      '    </component>',
      '    <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64" publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS">',
      '      <UserAccounts>'
    );

    if (accounts.length > 0) {
      xmlLines.push('        <LocalAccounts>');
      accounts.forEach(acc => {
        xmlLines.push('          <LocalAccount wcm:action="add">');
        xmlLines.push(`            <Name>${acc.name}</Name>`);
        xmlLines.push(`            <DisplayName>${acc.displayName}</DisplayName>`);
        xmlLines.push(`            <Group>${acc.group}</Group>`);
        xmlLines.push('            <Password>');
        xmlLines.push(`              <Value>${acc.password}</Value>`);
        xmlLines.push('              <PlainText>true</PlainText>');
        xmlLines.push('            </Password>');
        xmlLines.push('          </LocalAccount>');
      });
      xmlLines.push('        </LocalAccounts>');
    }

    xmlLines.push(
      '      </UserAccounts>',
      '      <OOBE>',
      '        <HideEULAPage>true</HideEULAPage>',
      '        <HideOnlineAccountScreens>true</HideOnlineAccountScreens>',
      '        <HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>',
      '      </OOBE>',
      '    </component>',
      '  </settings>',
      '</unattend>'
    );

    return xmlLines.join('\n');
  }

  // XMLをパースしてフォームに入力値を反映するインポーター
  function applyXmlToForm(xmlText) {
    try {
      const parser = new DOMParser();
      const dom = parser.parseFromString(xmlText, 'application/xml');
      if (dom.querySelector('parsererror')) {
        alert('無効なXML形式です。');
        return false;
      }

      const uiLang = dom.querySelector('UILanguage');
      if (uiLang) {
        const sel = document.querySelector('select[name="Locale"]');
        if (sel) {
          sel.value = uiLang.textContent.trim();
          sel.dispatchEvent(new Event('change'));
        }
      }

      const compElem = dom.querySelector('ComputerName');
      if (compElem && compElem.textContent.trim() !== '*') {
        const rCustom = document.querySelector('input[name="ComputerNameMode"][value="Custom"]');
        if (rCustom) {
          rCustom.checked = true;
          rCustom.dispatchEvent(new Event('change'));
        }
        const compInp = document.querySelector('input[name="ComputerName"]');
        if (compInp) {
          compInp.value = compElem.textContent.trim();
          compInp.dispatchEvent(new Event('input'));
        }
      }

      const localAccs = dom.querySelectorAll('LocalAccount');
      localAccs.forEach((acc, idx) => {
        const name = acc.querySelector('Name')?.textContent.trim();
        const disp = acc.querySelector('DisplayName')?.textContent.trim();
        const group = acc.querySelector('Group')?.textContent.trim();
        const pass = acc.querySelector('Password > Value')?.textContent.trim();

        if (name) {
          const nameInput = document.querySelector(`input[name="AccountName${idx}"]`);
          if (nameInput) {
            nameInput.value = name;
            nameInput.dispatchEvent(new Event('input'));
          }
        }
        if (disp) {
          const dispInput = document.querySelector(`input[name="AccountDisplayName${idx}"]`);
          if (dispInput) dispInput.value = disp;
        }
        if (group) {
          const groupSel = document.querySelector(`select[name="AccountGroup${idx}"]`);
          if (groupSel) groupSel.value = group;
        }
        if (pass) {
          const passInput = document.querySelector(`input[name="AccountPassword${idx}"]`);
          if (passInput) passInput.value = pass;
        }
      });

      alert('XMLファイルのインポートが完了しました。');
      return true;
    } catch (err) {
      console.error('Import error:', err);
      alert('インポート中にエラーが発生しました: ' + err.message);
      return false;
    }
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function initEngine() {
    document.addEventListener('click', function (e) {
      const target = e.target;
      if (!target || target.tagName !== 'BUTTON') return;

      const formaction = target.getAttribute('formaction') || '';
      const text = target.textContent.trim();

      if (formaction.includes('download') || text.includes('Download .xml file') || text.includes('.xmlファイルをダウンロード')) {
        e.preventDefault();
        const form = document.querySelector('form[action="./"]') || document.querySelector('form');
        const formData = new FormData(form);
        const xml = generateAutounattendXml(formData);
        const filename = formData.get('CustomUnattendXml') ? 'notautounattend.xml' : 'autounattend.xml';
        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        triggerDownload(blob, filename);
      }
      else if (formaction.includes('view') || text.includes('View .xml file') || text.includes('.xmlファイルを表示する')) {
        e.preventDefault();
        const form = document.querySelector('form[action="./"]') || document.querySelector('form');
        const formData = new FormData(form);
        const xml = generateAutounattendXml(formData);
        const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
      else if (formaction.includes('iso') || text.includes('.iso') || text.includes('wrapped in .iso')) {
        e.preventDefault();
        const form = document.querySelector('form[action="./"]') || document.querySelector('form');
        const formData = new FormData(form);
        const xml = generateAutounattendXml(formData);
        const filename = formData.get('CustomUnattendXml') ? 'notautounattend.xml' : 'autounattend.xml';
        const isoBlob = createIsoBlob(filename, xml);
        triggerDownload(isoBlob, 'unattend.iso');
      }
      else if (text.includes('Import file') || text.includes('ファイルのインポート')) {
        const fileInput = document.getElementById('Upload');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = function (evt) {
            applyXmlToForm(evt.target.result);
          };
          reader.readAsText(fileInput.files[0]);
        }
      }
    });

    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'Upload') {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function (evt) {
            applyXmlToForm(evt.target.result);
          };
          reader.readAsText(file);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEngine);
  } else {
    initEngine();
  }

  window.UnattendXmlEngine = {
    generateAutounattendXml,
    applyXmlToForm,
    createIsoBlob
  };

})();
