/**
 * Modifier Synchronization & Parity Checker Tool
 * Scans C# modifier/*.cs and verifies/synchronizes JS docs/js/modifiers/*.js
 *
 * Usage:
 *   node build/sync_modifiers.js --check       # Verify synchronization (for CI/CD)
 *   node build/sync_modifiers.js --list        # Show modifier mapping status
 *   node build/sync_modifiers.js --generate    # Generate stubs for unmapped modifiers
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const modifierDir = path.join(repoRoot, 'modifier');
const docsJsDir = path.join(repoRoot, 'docs', 'js');
const jsModifiersDir = path.join(docsJsDir, 'modifiers');
const buildEngineFile = path.join(repoRoot, 'build', 'build_engine.js');
const generatorEngineFile = path.join(docsJsDir, 'generator_engine.js');

// Dedicated Modifiers (1-to-1 mapping with docs/js/modifiers/*.js)
const DEDICATED_MODIFIERS = {
  'AppLocker.cs': { jsFile: 'modifiers/applocker.js', className: 'AppLockerModifier' },
  'Bloatware.cs': { jsFile: 'modifiers/bloatware.js', className: 'BloatwareModifier' },
  'Build.cs': { jsFile: 'modifiers/build.js', className: 'BuildModifier' },
  'Bypass.cs': { jsFile: 'modifiers/bypass.js', className: 'BypassModifier' },
  'Components.cs': { jsFile: 'modifiers/components.js', className: 'ComponentsModifier' },
  'ComputerName.cs': { jsFile: 'modifiers/computer_name.js', className: 'ComputerNameModifier' },
  'Delete.cs': { jsFile: 'modifiers/delete.js', className: 'DeleteModifier' },
  'ExpressSettings.cs': { jsFile: 'modifiers/express_settings.js', className: 'ExpressSettingsModifier' },
  'Locales.cs': { jsFile: 'modifiers/locales.js', className: 'LocalesModifier' },
  'Lockout.cs': { jsFile: 'modifiers/lockout.js', className: 'LockoutModifier' },
  'Optimizations.cs': { jsFile: 'modifiers/optimizations.js', className: 'OptimizationsModifier' },
  'PasswordExpiration.cs': { jsFile: 'modifiers/password_expiration.js', className: 'PasswordExpirationModifier' },
  'ProductKey.cs': { jsFile: 'modifiers/product_key.js', className: 'ProductKeyModifier' },
  'Script.cs': { jsFile: 'modifiers/scripts.js', className: 'ScriptsModifier' },
  'TimeZone.cs': { jsFile: 'modifiers/time_zone.js', className: 'TimeZoneModifier' },
  'Users.cs': { jsFile: 'modifiers/users.js', className: 'UsersModifier' },
  'Wifi.cs': { jsFile: 'modifiers/wifi.js', className: 'WifiModifier' }
};

// Integrated / Embedded Modifiers (implemented inside core / engine)
const INTEGRATED_MODIFIERS = {
  'Accessibility.cs': 'docs/js/generator_engine.js (Client-side accessibility settings)',
  'DefaultUser.cs': 'docs/js/core/powershell_sequence.js / generator_engine.js',
  'Disk.cs': 'docs/js/modifiers/delete.js / generator_engine.js',
  'EmptyElements.cs': 'docs/js/core/xml_node.js (Empty elements clean-up)',
  'FirstLogon.cs': 'docs/js/core/powershell_sequence.js / generator_engine.js',
  'LocaleDispatcherModifier.cs': 'docs/js/modifiers/locales.js',
  'LocaleSpecificModifier.cs': 'docs/js/modifiers/locales.js',
  'locales/ja-JP_Modifier.cs': 'docs/js/modifiers/locales.js (Japanese locale & keyboard)',
  'Order.cs': 'docs/js/core/xml_node.js / generator_engine.js (XML order handling)',
  'Personalization.cs': 'docs/js/modifiers/optimizations.js (Personalization tweaks)',
  'Pretty.cs': 'docs/js/core/xml_node.js (XML pretty print)',
  'ProcessorArchitecture.cs': 'docs/js/generator_engine.js (Architecture setting)',
  'Specialize.cs': 'docs/js/core/powershell_sequence.js / generator_engine.js',
  'UserOnce.cs': 'docs/js/core/powershell_sequence.js / generator_engine.js'
};

function getCsFiles(dir, prefix = '') {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = prefix ? path.join(prefix, entry.name).replace(/\\/g, '/') : entry.name;
    if (entry.isDirectory()) {
      results = results.concat(getCsFiles(path.join(dir, entry.name), relPath));
    } else if (entry.isFile() && entry.name.endsWith('.cs')) {
      results.push(relPath);
    }
  }
  return results.sort();
}

function pascalToSnake(str) {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function getBundlerModuleFiles() {
  if (!fs.existsSync(buildEngineFile)) return [];
  const content = fs.readFileSync(buildEngineFile, 'utf8');
  const match = content.match(/const moduleFiles = \[([\s\S]*?)\];/);
  if (!match) return [];
  return match[1]
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith("'") && line.endsWith("',"))
    .map(line => line.slice(1, -2));
}
function checkSync() {
  console.log('====================================================');
  console.log('  C# -> JS Modifier Synchronization Check');
  console.log('====================================================\n');

  const csFiles = getCsFiles(modifierDir);
  const bundlerFiles = getBundlerModuleFiles();

  let hasError = false;
  const missingJs = [];
  const missingInBundler = [];
  const unmappedCs = [];

  console.log(`Scanning C# modifiers in ${modifierDir} (${csFiles.length} files found)...`);

  for (const csFile of csFiles) {
    if (DEDICATED_MODIFIERS[csFile]) {
      const mapping = DEDICATED_MODIFIERS[csFile];
      const jsFullPath = path.join(docsJsDir, ...mapping.jsFile.split('/'));
      if (!fs.existsSync(jsFullPath)) {
        missingJs.push({ cs: csFile, js: mapping.jsFile });
        hasError = true;
      } else if (!bundlerFiles.includes(mapping.jsFile)) {
        missingInBundler.push({ cs: csFile, js: mapping.jsFile });
        hasError = true;
      }
    } else if (INTEGRATED_MODIFIERS[csFile]) {
      // Integrated modifier, mapped to existing core/engine
    } else {
      // Unmapped C# file
      unmappedCs.push(csFile);
      hasError = true;
    }
  }

  // Also check if any JS modifier in docs/js/modifiers/*.js is missing from bundler
  if (fs.existsSync(jsModifiersDir)) {
    const jsFiles = fs.readdirSync(jsModifiersDir).filter(f => f.endsWith('.js'));
    for (const js of jsFiles) {
      const rel = 'modifiers/' + js;
      if (!bundlerFiles.includes(rel)) {
        missingInBundler.push({ cs: '(JS only)', js: rel });
        hasError = true;
      }
    }
  }

  // Output results
  console.log('\n--- Verification Summary ---');
  console.log(`Total C# modifier files: ${csFiles.length}`);
  console.log(`Dedicated JS modifiers : ${Object.keys(DEDICATED_MODIFIERS).length}`);
  console.log(`Integrated modifiers   : ${Object.keys(INTEGRATED_MODIFIERS).length}`);

  if (unmappedCs.length > 0) {
    console.error('\n[ERROR] Unmapped C# modifier(s) detected:');
    for (const u of unmappedCs) {
      console.error(`  - modifier/${u}`);
    }
    console.error('Action required: Implement matching JS modifier or run `node build/sync_modifiers.js --generate`');
  }

  if (missingJs.length > 0) {
    console.error('\n[ERROR] Dedicated JS modifier file(s) missing:');
    for (const m of missingJs) {
      console.error(`  - ${m.cs} -> docs/js/${m.js} (Not Found)`);
    }
  }

  if (missingInBundler.length > 0) {
    console.error('\n[ERROR] JS modifier(s) missing from build/build_engine.js moduleFiles:');
    for (const b of missingInBundler) {
      console.error(`  - ${b.js}`);
    }
  }

  if (!hasError) {
    console.log('\n[PASS] All C# modifiers are properly synchronized and bundled!');
    return 0;
  } else {
    console.error('\n[FAIL] Modifier synchronization check failed.');
    return 1;
  }
}

function listModifiers() {
  console.log('====================================================');
  console.log('  C# <-> JS Modifier Mapping Table');
  console.log('====================================================\n');

  const csFiles = getCsFiles(modifierDir);
  console.log('--- Dedicated Modifiers (1-to-1) ---');
  for (const [cs, mapping] of Object.entries(DEDICATED_MODIFIERS)) {
    const exists = fs.existsSync(path.join(docsJsDir, ...mapping.jsFile.split('/'))) ? '✓' : '✗';
    console.log(`  [${exists}] modifier/${cs.padEnd(26)} -> docs/js/${mapping.jsFile} (${mapping.className})`);
  }

  console.log('\n--- Integrated / Core-embedded Modifiers ---');
  for (const [cs, location] of Object.entries(INTEGRATED_MODIFIERS)) {
    console.log(`  [✓] modifier/${cs.padEnd(26)} -> ${location}`);
  }

  const unmapped = csFiles.filter(cs => !DEDICATED_MODIFIERS[cs] && !INTEGRATED_MODIFIERS[cs]);
  if (unmapped.length > 0) {
    console.log('\n--- Unmapped C# Modifiers ---');
    for (const u of unmapped) {
      console.log(`  [!] modifier/${u}`);
    }
  } else {
    console.log('\nNo unmapped modifiers found.');
  }
}
function generateModifierStub(csFileName) {
  const baseName = path.basename(csFileName, '.cs');
  const snakeName = pascalToSnake(baseName);
  const className = baseName + 'Modifier';
  const jsRelPath = 'modifiers/' + snakeName + '.js';
  const jsFullPath = path.join(docsJsDir, 'modifiers', snakeName + '.js');

  console.log(`\nGenerating stub for modifier/${csFileName}...`);

  if (fs.existsSync(jsFullPath)) {
    console.log(`File already exists: ${jsFullPath}`);
    return;
  }

  const stubContent = `/**
 * ${baseName} modifier auto-generated by build/sync_modifiers.js
 * Corresponds to C# modifier/${csFileName}
 */
function ${className}(context) {
  this.context = context;
}

${className}.prototype.process = function () {
  var ctx = this.context;
  // TODO: Implement modifier transformation logic
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ${className}: ${className} };
}
`;

  fs.writeFileSync(jsFullPath, stubContent, 'utf8');
  console.log(`  -> Created ${jsFullPath}`);

  // Register in build/build_engine.js if needed
  if (fs.existsSync(buildEngineFile)) {
    let buildEngineContent = fs.readFileSync(buildEngineFile, 'utf8');
    if (!buildEngineContent.includes(`'${jsRelPath}'`)) {
      buildEngineContent = buildEngineContent.replace(
        /(\s*'modifiers\/scripts\.js',)/,
        `$1\r\n  '${jsRelPath}',`
      );
      fs.writeFileSync(buildEngineFile, buildEngineContent, 'utf8');
      console.log(`  -> Registered '${jsRelPath}' in build/build_engine.js`);
    }
  }

  // Register in docs/js/generator_engine.js pipeline
  if (fs.existsSync(generatorEngineFile)) {
    let genEngineContent = fs.readFileSync(generatorEngineFile, 'utf8');
    if (!genEngineContent.includes(className)) {
      genEngineContent = genEngineContent.replace(
        /(\s*new ScriptsModifier\(context\))/,
        `$1,\r\n    new ${className}(context)`
      );
      fs.writeFileSync(generatorEngineFile, genEngineContent, 'utf8');
      console.log(`  -> Registered ${className} in docs/js/generator_engine.js`);
    }
  }

  console.log(`Successfully scaffolded ${className} (${jsRelPath})!`);
}

function generateStubs(targetCs) {
  const csFiles = getCsFiles(modifierDir);
  const unmapped = csFiles.filter(cs => !DEDICATED_MODIFIERS[cs] && !INTEGRATED_MODIFIERS[cs]);

  if (targetCs) {
    generateModifierStub(targetCs);
  } else if (unmapped.length > 0) {
    console.log(`Found ${unmapped.length} unmapped modifier(s). Generating stubs...`);
    for (const u of unmapped) {
      generateModifierStub(u);
    }
  } else {
    console.log('No unmapped modifiers found. All modifiers are synchronized.');
  }
}

// CLI Routing
const arg = process.argv[2];
const opt = process.argv[3];

if (arg === '--check') {
  const exitCode = checkSync();
  process.exit(exitCode);
} else if (arg === '--list') {
  listModifiers();
} else if (arg === '--generate') {
  generateStubs(opt);
} else {
  console.log(`Modifier Synchronization Tool

Usage:
  node build/sync_modifiers.js --check       Verify sync between C# and JS
  node build/sync_modifiers.js --list        List all modifier mappings
  node build/sync_modifiers.js --generate    Generate stub for unmapped modifier(s)
`);
  process.exit(0);
}

