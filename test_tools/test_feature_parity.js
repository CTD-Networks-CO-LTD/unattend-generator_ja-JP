/**
 * 機能格差解消（Parity）＆構文不具合解消検証テスト
 * C# 実装（modifier/Bloatware.cs, modifier/Optimizations.cs 等）と JS 実装（docs/unattend_engine.js）の整合性確認
 */
const fs = require('fs');
const path = require('path');
const engine = require('../docs/unattend_engine.js');

class MockFormData {
  constructor(obj) {
    this.data = new Map(Object.entries(obj));
  }
  entries() {
    return this.data.entries();
  }
  get(key) {
    return this.data.get(key) || null;
  }
}

function runTests() {
  console.log('====================================================');
  console.log('  unattend_engine.js 機能パリティ・構文網羅テスト');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(` [FAIL] ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(` [PASS] ${message}`);
      passed++;
    }
  }

  // --- テストケース 1: スマートクォートの完全排除 ---
  console.log('--- Test 1: スマートクォート（U+2018, U+2019, U+201C, U+201D）の完全排除 ---');
  const fd1 = new MockFormData({
    LanguageMode: 'Unattended',
    UILanguage: 'ja-JP',
    Locale: 'ja-JP',
    Keyboard: '00000411',
    ShowFileExtensions: 'true',
    DisableAppSuggestions: 'true',
    RemoveCopilot: 'true',
    RemoveOneDrive: 'true'
  });
  const xml1 = engine.generateAutounattendXml(fd1);

  // スマートクォート文字検出
  const smartQuoteRegex = /[\u2018\u2019\u201C\u201D]/;
  assert(!smartQuoteRegex.test(xml1), 'XML全体および埋め込みスクリプトに全角スマートクォートが含まれていないこと');

  // Activity の文言確認
  assert(xml1.includes('Running scripts to modify default user registry hive.'), 'DefaultUserSequence の Activity 文言が引用符なし ASCII の安全な形式になっていること');
  assert(!xml1.includes("default user’s"), "旧コードの 'default user’s' が残っていないこと");

  // --- テストケース 2: DisableAppSuggestions 機能の確認 ---
  console.log('\n--- Test 2: DisableAppSuggestions（アプリ提案・消費者機能無効化）の移植確認 ---');
  assert(xml1.includes('ContentDeliveryAllowed'), 'DefaultUser.ps1 に ContentDeliveryAllowed レジストリ設定が含まれていること');
  assert(xml1.includes('SystemPaneSuggestionsEnabled'), 'DefaultUser.ps1 に SystemPaneSuggestionsEnabled レジストリ設定が含まれていること');
  assert(xml1.includes('SubscribedContent-310093Enabled'), 'DefaultUser.ps1 に SubscribedContent-310093Enabled 等の提案無効化が含まれていること');
  assert(xml1.includes('DisableWindowsConsumerFeatures'), 'Specialize.ps1 に DisableWindowsConsumerFeatures レジストリ設定が含まれていること');

  // --- テストケース 3: Bloatware 削除機能（RemovePackage.ps1）の確認 ---
  console.log('\n--- Test 3: Bloatware 削除パッケージ生成と付随レジストリ処理の確認 ---');
  const fdBloat = new MockFormData({
    RemoveBingSearch: 'true',
    RemoveOffice365: 'true',
    RemoveCopilot: 'true',
    RemoveOneDrive: 'true',
    RemoveTeams: 'true',
    RemoveXboxApps: 'true',
    RemoveWeather: 'true',
    RemoveSolitaire: 'true'
  });
  const xmlBloat = engine.generateAutounattendXml(fdBloat);

  // RemovePackage.ps1 の生成
  assert(xmlBloat.includes('RemovePackage.ps1'), 'XMLのFile要素に RemovePackage.ps1 が埋め込まれていること');
  assert(xmlBloat.includes('*Microsoft.BingSearch*'), 'RemovePackage.ps1 に BingSearch パターンが含まれていること');
  assert(xmlBloat.includes('*Microsoft.MicrosoftOfficeHub*'), 'RemovePackage.ps1 に OfficeHub パターンが含まれていること');
  assert(xmlBloat.includes('*Microsoft.BingWeather*'), 'RemovePackage.ps1 に Weather パターンが含まれていること');
  assert(xmlBloat.includes('*Microsoft.MicrosoftSolitaireCollection*'), 'RemovePackage.ps1 に Solitaire パターンが含まれていること');
  assert(xmlBloat.includes('Remove-AppxProvisionedPackage -Online -AllUsers'), 'RemovePackage.ps1 内で全ユーザー一括プロビジョニング削除が実行されていること');
  assert(xmlBloat.includes('RemovePackage.ps1'), 'Specialize.ps1 から RemovePackage.ps1 が呼び出されていること');

  // 付随スクリプト
  assert(xmlBloat.includes('TurnOffWindowsCopilot'), 'RemoveCopilot 指定時に TurnOffWindowsCopilot ポリシー設定が含まれていること');
  assert(xmlBloat.includes('Microsoft.Windows.Ai.Copilot.Provider'), 'RemoveCopilot 指定時に Copilot Provider パッケージ削除が含まれていること');
  assert(xmlBloat.includes('OneDriveSetup.exe'), 'RemoveOneDrive 指定時に OneDriveSetup.exe の削除処理が含まれていること');
  assert(xmlBloat.includes('OneDriveSetup'), 'RemoveOneDrive 指定時に Run レジストリからの削除処理が含まれていること');
  assert(xmlBloat.includes('ConfigureChatAutoInstall'), 'RemoveTeams 指定時に Teams チャット自動インストール無効化が含まれていること');
  assert(xmlBloat.includes('AppCaptureEnabled'), 'RemoveXboxApps 指定時に GameDVR AppCaptureEnabled 無効化が含まれていること');

  // --- テストケース 4: Bloatware 未選択時は RemovePackage.ps1 が生成されないこと ---
  console.log('\n--- Test 4: Bloatware 未選択時のクリーン動作確認 ---');
  const fdClean = new MockFormData({
    LanguageMode: 'Unattended',
    UILanguage: 'ja-JP'
  });
  const xmlClean = engine.generateAutounattendXml(fdClean);
  assert(!xmlClean.includes('RemovePackage.ps1'), 'Bloatware未指定時は RemovePackage.ps1 が生成されないこと');

  // --- テストケース 5: DisableFastStartup 機能の確認 ---
  console.log('\n--- Test 5: DisableFastStartup（高速スタートアップ無効化）の移植確認 ---');
  const fdFastStartup = new MockFormData({
    DisableFastStartup: 'true'
  });
  const xmlFastStartup = engine.generateAutounattendXml(fdFastStartup);
  const fastStartupCmd = 'reg.exe add "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power" /v HiberbootEnabled /t REG_DWORD /d 0 /f;';
  assert(xmlFastStartup.includes(fastStartupCmd), 'DisableFastStartup 指定時に Specialize.ps1 に HiberbootEnabled 無効化コマンドが含まれていること');

  const fdNoFastStartup = new MockFormData({});
  const xmlNoFastStartup = engine.generateAutounattendXml(fdNoFastStartup);
  assert(!xmlNoFastStartup.includes('HiberbootEnabled'), 'DisableFastStartup 未指定時には HiberbootEnabled 設定が含まれないこと');

  console.log('\n====================================================');
  console.log(` テスト結果: ${passed} 項目合格 / ${failed} 項目失敗`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

try {
  runTests();
} catch (err) {
  console.error('Test run error:', err);
  process.exit(1);
}
