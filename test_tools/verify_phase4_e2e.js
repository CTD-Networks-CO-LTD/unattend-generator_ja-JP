const engine = require('../docs/unattend_engine.js');

class MockFormData {
  constructor(o) {
    this.d = new Map(Object.entries(o));
  }
  entries() {
    return this.d.entries();
  }
  get(k) {
    return this.d.get(k) || null;
  }
}

console.log('====================================================');
console.log('  Phase 4 (WinPE Scripts) Full Lifecycle E2E');
console.log('====================================================\n');

function assert(condition, message) {
  if (condition) {
    console.log(' [PASS] ' + message);
  } else {
    console.error(' [FAIL] ' + message);
    process.exit(1);
  }
}

// 1. PEMode = 'Script' の E2E 検証
const samplePeScript = '@echo off\r\necho Custom PE Stage Executing\r\nwpeutil.exe Reboot';
const peScriptFd = new MockFormData({
  PEMode: 'Script',
  PEScript: samplePeScript
});
const peScriptXml = engine.generateAutounattendXml(peScriptFd);

assert(peScriptXml.includes('&gt;&gt;X:\\pe.cmd'), 'X:\\pe.cmd 書出コマンドが存在');
assert(peScriptXml.includes('cmd.exe /c "X:\\pe.cmd"'), 'X:\\pe.cmd 実行コマンドが存在');
assert(peScriptXml.includes('<PEScriptCopy>'), 'PEScriptCopy 要素が存在');
assert(peScriptXml.includes('Custom PE Stage Executing'), 'PEScriptCopy 内に入力スクリプトが存在');

const peScriptQuery = engine.extractQueryFromXml(peScriptXml);
assert(peScriptQuery !== null, 'クエリ文字列抽出成功 (PEMode=Script)');
const peScriptParams = new URLSearchParams(peScriptQuery);
assert(peScriptParams.get('PEMode') === 'Script', 'PEMode がクエリ復元パラメータと一致');
assert(peScriptParams.get('PEScript') === samplePeScript, 'PEScript がクエリ復元パラメータと一致');

// 2. PEMode = 'Generated', TargetDiskMode = 'Script', PartitionMode = 'Custom' の E2E 検証
const sampleTargetDiskScript = 'WScript.Echo 1\r\nWScript.Quit 0';
const sampleDiskpartScript = 'SELECT DISK=1\r\nCLEAN\r\nCONVERT GPT\r\nASSIGN LETTER=S\r\nASSIGN LETTER=W';

const generatedPeFd = new MockFormData({
  PEMode: 'Generated',
  TargetDiskMode: 'Script',
  TargetDiskScript: sampleTargetDiskScript,
  PartitionMode: 'Custom',
  DiskpartScript: sampleDiskpartScript
});
const generatedPeXml = engine.generateAutounattendXml(generatedPeFd);

assert(generatedPeXml.includes('&gt;&gt;X:\\pe.cmd'), 'X:\\pe.cmd 作成コマンドが存在 (Generated)');
assert(generatedPeXml.includes('&gt;X:\\target.vbs'), 'target.vbs 出力処理が存在');
assert(generatedPeXml.includes('&gt;X:\\diskpart.txt'), 'diskpart.txt 出力処理が存在');
assert(generatedPeXml.includes('diskpart.exe /s X:\\diskpart.txt'), 'diskpart.exe 実行処理が存在');
assert(generatedPeXml.includes('<PEScriptCopy>'), 'PEScriptCopy が存在 (Generated)');

const genQuery = engine.extractQueryFromXml(generatedPeXml);
assert(genQuery !== null, 'クエリ文字列抽出成功 (Generated)');
const genParams = new URLSearchParams(genQuery);
assert(genParams.get('PEMode') === 'Generated', 'PEMode=Generated がクエリ復元パラメータと一致');
assert(genParams.get('TargetDiskMode') === 'Script', 'TargetDiskMode=Script がクエリ復元パラメータと一致');
assert(genParams.get('TargetDiskScript') === sampleTargetDiskScript, 'TargetDiskScript がクエリ復元パラメータと一致');
assert(genParams.get('PartitionMode') === 'Custom', 'PartitionMode=Custom がクエリ復元パラメータと一致');
assert(genParams.get('DiskpartScript') === sampleDiskpartScript, 'DiskpartScript がクエリ復元パラメータと一致');

console.log('\n====================================================');
console.log(' 全 16 検証項目 合格！');
console.log('====================================================');
