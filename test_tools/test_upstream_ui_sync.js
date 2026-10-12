const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');

let passes = 0;
let fails = 0;
function assert(name, cond) {
  if (cond) {
    console.log(' [PASS] ' + name);
    passes++;
  } else {
    console.error(' [FAIL] ' + name);
    fails++;
  }
}

console.log('====================================================');
console.log('  Upstream UI Sync & Translation Parity Verification');
console.log('====================================================\n');

// 1. docs/index.html
const indexHtml = fs.readFileSync(path.join(repoRoot, 'docs/index.html'), 'utf8').replace(/\r\n/g, '\n');
assert('index.html: valid() has null guard', indexHtml.includes('if (element) {\n            element.setCustomValidity(\'\');'));
assert('index.html: invalid() has null guard', indexHtml.includes('if (!element) return;\n        element.setCustomValidity(message);'));
assert('index.html: change() has null guard', indexHtml.includes('function change(elements) {\n        if (!elements) return;'));
assert('index.html: whenEvent() has null guard', indexHtml.includes('function whenEvent(types, elements, callback) {\n        if (!elements) return;'));
assert('index.html: DiskAssertionMode has null guard', indexHtml.includes('if (partitionInteractive && assertionSkip) {'));
assert('index.html: TargetDiskScript length validator added', indexHtml.includes('textarea[name="TargetDiskScript"]'));
assert('index.html: contains .Hidden { display: none !important; } style', indexHtml.includes('.Hidden {\n  display: none !important;\n}'));
assert('index.html: contains input.AddMore !important style', indexHtml.includes('display: block !important;'));
assert('index.html: contains input.AddMore click handler', indexHtml.includes("whenClicked(document.querySelectorAll('input.AddMore')"));

// 1.1 docs/style.css
const styleCss = fs.readFileSync(path.join(repoRoot, 'docs/style.css'), 'utf8').replace(/\r\n/g, '\n');
assert('style.css: contains .Hidden { display: none !important; }', styleCss.includes('.Hidden {\n  display: none !important;\n}'));
assert('style.css: contains input.AddMore !important style', styleCss.includes('display: block !important;'));

// 1.2 docs/js/ui/form_bridge.js
const formBridgeJs = fs.readFileSync(path.join(repoRoot, 'docs/js/ui/form_bridge.js'), 'utf8').replace(/\r\n/g, '\n');
assert('form_bridge.js: auto-unhide filled .Hidden container', formBridgeJs.includes("container.classList.remove('Hidden')"));
assert('form_bridge.js: update AddMore button state', formBridgeJs.includes("btn.disabled = true"));

// 2. build/sync_upstream_site.js
const syncJs = fs.readFileSync(path.join(repoRoot, 'build/sync_upstream_site.js'), 'utf8').replace(/\r\n/g, '\n');
assert('sync_upstream_site.js: has --update-docs option', syncJs.includes("isUpdateDocs = args.includes('--update-docs')"));
assert('sync_upstream_site.js: has postProcessForDocs', syncJs.includes('function postProcessForDocs'));
assert('sync_upstream_site.js: has ensureTranslateAttributes', syncJs.includes('function ensureTranslateAttributes'));
assert('sync_upstream_site.js: has protectImageWords', syncJs.includes('function protectImageWords'));
assert('sync_upstream_site.js: has applyUiParityRules', syncJs.includes('function applyUiParityRules'));

// 3. docs/sections/02_windows_pe_stage.html
const peHtml = fs.readFileSync(path.join(repoRoot, 'docs/sections/02_windows_pe_stage.html'), 'utf8').replace(/\r\n/g, '\n');
assert('02_windows_pe_stage.html: contains PE description', peHtml.includes('Choose this for a fully automated installation, particularly on VMs or when you are okay with wiping existing partitions.'));
assert('02_windows_pe_stage.html: contains TargetDiskMode', peHtml.includes('name="TargetDiskMode"'));
assert('02_windows_pe_stage.html: contains TargetDiskScript with translate=no', peHtml.includes('textarea translate="no" class="notranslate" rows="25" name="TargetDiskScript"'));
assert('02_windows_pe_stage.html: contains Windows <span...image</span> in compact mode', peHtml.includes('Apply Windows <span translate="no" class="notranslate">image</span> in compact mode'));
assert('02_windows_pe_stage.html: contains Select <span...image</span> for this edition', peHtml.includes('Select <span translate="no" class="notranslate">image</span> for this <strong>edition</strong>:'));
assert('02_windows_pe_stage.html: preserves absolute link to no-8.3', peHtml.includes('href="https://schneegans.de/windows/no-8.3/"'));

// 4. docs/sections/23_personalization.html
const persHtml = fs.readFileSync(path.join(repoRoot, 'docs/sections/23_personalization.html'), 'utf8').replace(/\r\n/g, '\n');
assert('23_personalization.html: contains desktop wallpaper <span...image</span>', persHtml.includes('desktop wallpaper <span translate="no" class="notranslate">image</span>:'));
assert('23_personalization.html: contains Lock screen <span...image</span>', persHtml.includes('Lock screen <span translate="no" class="notranslate">image</span>'));

// 5. .github/workflows/sync-upstream.yml
const yml = fs.readFileSync(path.join(repoRoot, '.github/workflows/sync-upstream.yml'), 'utf8').replace(/\r\n/g, '\n');
assert('sync-upstream.yml: runs --update-cache --update-docs', yml.includes('node build/sync_upstream_site.js --update-cache --update-docs'));
assert('sync-upstream.yml: runs test_ui_parity.js', yml.includes('node test_tools/test_ui_parity.js'));
assert('sync-upstream.yml: stages docs/sections/', yml.includes('git add .upstream-cache/ docs/sections/'));

// 6. .github/workflows/deploy-pages.yml
const deployYml = fs.readFileSync(path.join(repoRoot, '.github/workflows/deploy-pages.yml'), 'utf8').replace(/\r\n/g, '\n');
assert('deploy-pages.yml: runs test_ui_parity.js', deployYml.includes('node test_tools/test_ui_parity.js'));

console.log('\n====================================================');
console.log(` Results: ${passes} PASSED / ${fails} FAILED`);
console.log('====================================================');
process.exit(fails > 0 ? 1 : 0);
