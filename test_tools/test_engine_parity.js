/**
 * Comprehensive Engine Parity Test
 * Compares baseline_unattend_engine.js vs bundled docs/unattend_engine.js
 */
const fs = require('fs');
const path = require('path');

const baselinePath = path.resolve(__dirname, 'baseline_unattend_engine.js');
const bundledPath = path.resolve(__dirname, '../docs/unattend_engine.js');

const baselineEngine = require(baselinePath);
const bundledEngine = require(bundledPath);

function createMockFormData(data) {
  return {
    get: (key) => (key in data ? String(data[key]) : null),
    has: (key) => key in data,
    getAll: (key) => (key in data ? (Array.isArray(data[key]) ? data[key] : [data[key]]) : [])
  };
}

const testCases = [
  {
    name: 'Case 1: Default baseline settings',
    params: {}
  },
  {
    name: 'Case 2: Japanese 106/109 Keyboard with ja-JP locale and Tokyo TimeZone',
    params: {
      LanguageMode: 'Unattended',
      Locale: 'ja-JP',
      Keyboard: '00000411',
      GeoLocation: '122',
      TimeZoneMode: 'Explicit',
      TimeZone: 'Tokyo Standard Time',
      ProcessorArchitecture: 'amd64'
    }
  },
  {
    name: 'Case 3: English US Keyboard with en-US locale',
    params: {
      LanguageMode: 'Unattended',
      Locale: 'en-US',
      Keyboard: '00000409',
      GeoLocation: '244',
      TimeZoneMode: 'Explicit',
      TimeZone: 'Pacific Standard Time',
      ProcessorArchitecture: 'amd64'
    }
  },
  {
    name: 'Case 4: User Accounts (Admin + Standard user with passwords)',
    params: {
      UserAccountMode: 'Unattended',
      AccountName0: 'adminuser',
      AccountDisplayName0: 'Administrator User',
      AccountGroup0: 'Administrators',
      AccountPassword0: 'Passw0rd123!',
      AccountName1: 'stduser',
      AccountDisplayName1: 'Standard User',
      AccountGroup1: 'Users',
      AccountPassword1: 'UserPass456!',
      AutoLogonMode: 'Own',
      AutoLogonUsername: 'adminuser',
      AutoLogonPassword: 'Passw0rd123!'
    }
  },
  {
    name: 'Case 5: Bloatware Removal (Bing, Copilot, Teams, OneDrive, Xbox, Solitaire)',
    params: {
      RemoveBingSearch: 'true',
      RemoveCopilot: 'true',
      RemoveTeams: 'true',
      RemoveOneDrive: 'true',
      RemoveXboxApps: 'true',
      RemoveSolitaire: 'true',
      RemoveWeather: 'true',
      RemoveOffice365: 'true'
    }
  },
  {
    name: 'Case 6: Optimizations (DisableAppSuggestions, ClassicTaskbar, etc.)',
    params: {
      DisableAppSuggestions: 'true',
      DisableTelemetry: 'true',
      HideTaskbarSearch: 'true',
      HideTaskViewButton: 'true',
      DisableWidgets: 'true',
      ClassicTaskbar: 'true'
    }
  },
  {
    name: 'Case 7: Wi-Fi setup (Profile SSID & PreSharedKey)',
    params: {
      WifiMode: 'Interactive',
      WifiSsid: 'Company-WiFi',
      WifiPassword: 'SecretPassword99'
    }
  },
  {
    name: 'Case 8: Custom Product Key & Computer Name',
    params: {
      WindowsEditionMode: 'Custom',
      ProductKey: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T',
      ComputerNameMode: 'Custom',
      ComputerName: 'DESKTOP-TEST01'
    }
  },
  {
    name: 'Case 9: Bypass requirements & Express settings',
    params: {
      BypassTPMCheck: 'true',
      BypassSecureBootCheck: 'true',
      BypassRAMCheck: 'true',
      BypassStorageCheck: 'true',
      BypassCPUCheck: 'true',
      ExpressSettings: 'DisableAll'
    }
  },
  {
    name: 'Case 10: Fast Startup disabled',
    params: {
      DisableFastStartup: 'true',
      DisableWidgets: 'true',
      DisableAppSuggestions: 'true'
    }
  }
];

console.log('====================================================');
console.log('  Baseline vs Modular Engine Parity Verification    ');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

testCases.forEach((tc, idx) => {
  const fd = createMockFormData(tc.params);
  const baselineXml = baselineEngine.generateAutounattendXml(fd);
  const bundledXml = bundledEngine.generateAutounattendXml(fd);

  if (baselineXml === bundledXml) {
    console.log(`[PASS] ${tc.name} (Byte exact: ${baselineXml.length} chars)`);
    passCount++;
  } else {
    console.log(`[FAIL] ${tc.name}`);
    failCount++;
    console.log(`  Baseline length: ${baselineXml.length}, Bundled length: ${bundledXml.length}`);

    // Find first difference
    const minLen = Math.min(baselineXml.length, bundledXml.length);
    let diffIdx = -1;
    for (let i = 0; i < minLen; i++) {
      if (baselineXml[i] !== bundledXml[i]) {
        diffIdx = i;
        break;
      }
    }
    if (diffIdx === -1 && baselineXml.length !== bundledXml.length) {
      diffIdx = minLen;
    }

    if (diffIdx !== -1) {
      const start = Math.max(0, diffIdx - 50);
      const end = Math.min(minLen, diffIdx + 50);
      console.log(`  First diff at char ${diffIdx}:`);
      console.log(`  Baseline: "...${baselineXml.substring(start, end).replace(/\r/g, '\\r').replace(/\n/g, '\\n')}..."`);
      console.log(`  Bundled : "...${bundledXml.substring(start, end).replace(/\r/g, '\\r').replace(/\n/g, '\\n')}..."`);
    }
  }
});

console.log('\n====================================================');
console.log(` Results: ${passCount} PASSED / ${failCount} FAILED`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
}
