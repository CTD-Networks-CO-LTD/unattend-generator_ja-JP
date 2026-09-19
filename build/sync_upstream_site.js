/**
 * Upstream Site UI Synchronization & Parsing Tool
 * Fetches https://schneegans.de/windows/unattend-generator/, applies exclusion rules,
 * and detects structural diffs against .upstream-cache/sections/
 *
 * Usage:
 *   node build/sync_upstream_site.js --check
 *   node build/sync_upstream_site.js --update-cache
 *   node build/sync_upstream_site.js --report <output.md>
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const cacheDir = path.join(repoRoot, '.upstream-cache', 'sections');
const docsSectionsDir = path.join(repoRoot, 'docs', 'sections');
const defaultUrl = 'https://schneegans.de/windows/unattend-generator/';

const SECTION_FILES = [
  '01_region_language.html',
  '02_windows_pe_stage.html',
  '03_activation.html',
  '04_processor_architectures.html',
  '05_setup_settings.html',
  '06_computer_name.html',
  '07_time_zone.html',
  '08_user_accounts.html',
  '09_password_expiration.html',
  '10_account_lockout.html',
  '11_explorer_tweaks.html',
  '12_start_taskbar.html',
  '13_system_tweaks.html',
  '14_visual_effects.html',
  '15_desktop_icons.html',
  '16_folders_start.html',
  '17_vm_hosts.html',
  '18_vm_guests.html',
  '19_wifi_setup.html',
  '20_express_settings.html',
  '21_lock_keys.html',
  '22_sticky_keys.html',
  '23_personalization.html',
  '24_remove_bloatware.html',
  '25_custom_scripts.html',
  '26_applocker.html',
  '27_xml_components.html',
  '28_download_settings.html',
  '29_submit_form.html'
];

/**
 * Normalizes text line endings and trailing whitespace.
 */
function normalizeHtml(html) {
  if (!html) return '';
  const lines = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.map(line => line.trimEnd()).join('\r\n').trimEnd() + '\r\n';
}

/**
 * Extracts top-level TR elements from the main form table.
 */
function extractTableRows(mainFormHtml) {
  const tableStart = mainFormHtml.indexOf('<table');
  if (tableStart === -1) return [];
  const tableEnd = mainFormHtml.lastIndexOf('</table>');
  if (tableEnd === -1) return [];

  const tableInner = mainFormHtml.substring(tableStart, tableEnd + 8);
  let depth = 0;
  let trStart = -1;
  const trs = [];

  const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
  let m;
  while ((m = tagRegex.exec(tableInner)) !== null) {
    const tagName = m[1].toLowerCase();
    const isClosing = m[0].startsWith('</');

    if (tagName === 'table') {
      if (isClosing) depth--;
      else depth++;
    } else if (tagName === 'tr') {
      if (depth === 1) {
        if (!isClosing) {
          trStart = m.index;
        } else if (trStart !== -1) {
          const trEnd = m.index + m[0].length;
          trs.push(tableInner.substring(trStart, trEnd));
          trStart = -1;
        }
      }
    }
  }
  return trs;
}

/**
 * Applies permanent exclusion rules to raw HTML.
 */
function applyExclusions(sectionKey, rawHtml) {
  let html = rawHtml;

  // Rule 2: Client-side URL normalization for buttons and form endpoints
  html = html.replace(/formaction="\/windows\/unattend-generator\/"/g, 'formaction="./"');
  html = html.replace(/formaction="\."/g, 'formaction="./"');

  if (sectionKey === 'header' || sectionKey === 'header.html') {
    // Remove Breadcrumb navigation
    html = html.replace(/<p class="Breadcrumb">[\s\S]*?<\/p>/gi, '');

    // Normalize Title for Windows 11 only policy
    html = html.replace(
      /<h1>Generate <code>autounattend\.xml<\/code> files for Windows(&#xA0;|\s)10\/11<\/h1>/gi,
      '<h1>Generate <code translate="no" class="notranslate">autounattend.xml</code> files for Windows 11</h1>'
    );

    // Normalize Description
    html = html.replace(
      /unattended installations<\/strong> of both Windows(&#xA0;|\s)10 and Windows(&#xA0;|\s)11/gi,
      'unattended installations</strong> of Windows 11'
    );

    // Filter donation and external doc links in centered paragraph
    html = html.replace(/<a href="\/windows\/unattend-generator\/usage\/"[^>]*>.*?<\/a>\s*·\s*/gi, '');
    html = html.replace(/<a href="\/windows\/unattend-generator\/samples\/"[^>]*>.*?<\/a>\s*·\s*/gi, '');
    html = html.replace(/<a href="https:\/\/paypal\.me\/[^"]*"[^>]*>.*?<\/a>\s*·\s*/gi, '');
    html = html.replace(/<a href="https:\/\/buymeacoffee\.com\/[^"]*"[^>]*>.*?<\/a>\s*·\s*/gi, '');
    html = html.replace(/https:\/\/github\.com\/cschneegans\/unattend-generator/g, 'https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP');
  } else if (sectionKey === 'presets' || sectionKey === 'presets.html') {
    // Normalize upload form and preset forms
    html = html.replace(/<form method="post" action="\." enctype="multipart\/form-data">/g,
      '<form method="post" action="./" enctype="multipart/form-data" onsubmit="return false;">');
    html = html.replace(/<form method="get" action="\."/g,
      '<form method="get" action="./"');
    html = html.replace(/<form method="post" action="\."/g,
      '<form method="post" action="./"');
  } else if (sectionKey === '12_start_taskbar.html') {
    // Rule 3: Exclude Windows 10 Start Menu tile configuration fieldset
    const win10LegendRegex = /<fieldset class="has-legend">\s*<legend>Windows(&#xA0;|\s)10<\/legend>[\s\S]*?<\/fieldset>/gi;
    html = html.replace(win10LegendRegex, '');
  }

  return normalizeHtml(html);
}

/**
 * Ensures translate="no" and class="... notranslate" on specified HTML tag.
 */
function ensureTranslateAttributes(tag, html) {
  const regex = new RegExp(`(<${tag}\\b)([^>]*?)>`, 'gi');
  return html.replace(regex, (match, tagStart, rest) => {
    const hasTranslate = /\btranslate=/i.test(rest);
    const hasClass = /\bclass="([^"]*)"/i.test(rest);
    const hasNotranslateClass = /\bclass="[^"]*\bnotranslate\b[^"]*"/i.test(rest);

    if (hasTranslate && hasNotranslateClass) {
      return `${tagStart}${rest}>`;
    }

    let updatedRest = rest;
    if (hasClass) {
      updatedRest = updatedRest.replace(/\bclass="([^"]*)"/i, (m, cls) => {
        const classes = cls.split(/\s+/).filter(Boolean);
        if (!classes.includes('notranslate')) classes.push('notranslate');
        return `class="${classes.join(' ')}"`;
      });
    }

    if (!hasTranslate && !hasClass) {
      return `${tagStart} translate="no" class="notranslate"${updatedRest}>`;
    } else if (!hasTranslate && hasClass) {
      return `${tagStart} translate="no"${updatedRest}>`;
    } else if (hasTranslate && !hasClass) {
      return `${tagStart} class="notranslate"${updatedRest}>`;
    }
    return `${tagStart}${updatedRest}>`;
  });
}

/**
 * Protects occurrences of "image", "images", and "imaging" in visible text from translation.
 */
function protectImageWords(html) {
  const tokens = html.split(/(<[^>]+>)/g);
  let skipDepth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (t.startsWith('<')) {
      const isClosing = t.startsWith('</');
      const tagMatch = t.match(/<\/?([a-zA-Z0-9]+)/);
      const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
      const hasNoTranslate = /\bclass=["'][^"']*\bnotranslate\b/i.test(t) || /\btranslate=["']no["']/i.test(t);
      if (['textarea', 'code', 'script', 'style'].includes(tagName) || hasNoTranslate) {
        if (!isClosing && !t.endsWith('/>')) {
          skipDepth++;
        }
      }
      if (isClosing) {
        if (skipDepth > 0) skipDepth--;
      }
    } else {
      if (skipDepth === 0) {
        tokens[i] = t
          .replace(/\bimages\b/g, '<span translate="no" class="notranslate">images</span>')
          .replace(/\bimage\b/g, '<span translate="no" class="notranslate">image</span>')
          .replace(/\bimaging\b/g, '<span translate="no" class="notranslate">imaging</span>');
      }
    }
  }
  return tokens.join('');
}

/**
 * Applies Fork-specific post-processing to HTML before writing to docs/sections/.
 */
function postProcessForDocs(fileName, rawHtml, existingDocsHtml) {
  if (fileName === 'header.html') {
    if (existingDocsHtml) {
      return existingDocsHtml;
    }
    let h = rawHtml;
    h = ensureTranslateAttributes('code', h);
    return normalizeHtml(h);
  }

  if (fileName === 'presets.html') {
    if (existingDocsHtml) {
      return existingDocsHtml;
    }
    let p = rawHtml;
    p = p.replace(/<form method="post" action="[^"]*" enctype="multipart\/form-data"[^>]*>/g,
      '<form method="post" action="./" enctype="multipart/form-data" onsubmit="return false;">');
    p = p.replace(/action="\."/g, 'action="./"');
    p = p.replace(/formaction="\."/g, 'formaction="./"');
    return normalizeHtml(p);
  }

  let html = rawHtml;

  // Indent table rows with 6 spaces if starting with <tr> without indent
  html = html.replace(/^<tr>/, '      <tr>');
  html = html.replace(/\n<\/tr>\s*$/, '\n      </tr>\r\n');
  html = html.replace(/href="\/windows\//g, 'href="https://schneegans.de/windows/');

  if (fileName === '01_region_language.html') {
    html = html.replace(/Windows(&#xA0;|\s)10\/11 \.iso file/gi, 'Windows&#xA0;11 .iso file');
  }

  // 1. Ensure translate="no" class="notranslate" on form elements and code
  html = ensureTranslateAttributes('select', html);
  html = ensureTranslateAttributes('option', html);
  html = ensureTranslateAttributes('code', html);
  html = ensureTranslateAttributes('textarea', html);

  // 2. Protect "image", "images", "imaging" in text nodes
  html = protectImageWords(html);

  return normalizeHtml(html);
}

/**
 * Parses full upstream HTML page into separate sections.
 */
function parseUpstreamHtml(html) {
  const sections = {};

  // Extract upstream commit hash
  const commitMatch = html.match(/commit\/([0-9a-f]{7,40})/i);
  const upstreamCommit = commitMatch ? commitMatch[1].substring(0, 7) : 'latest';

  // 1. Header
  const headerStart = html.indexOf('<div class="Header">');
  const presetsStart = html.indexOf('<div class="Presets">');
  if (headerStart !== -1 && presetsStart !== -1) {
    const rawHeader = html.substring(headerStart, presetsStart).trim();
    sections['header.html'] = applyExclusions('header', rawHeader);
  }

  // 2. Presets
  const formMatches = [...html.matchAll(/<form\b[^>]*>/gi)];
  let mainFormStart = -1;
  for (let i = 0; i < formMatches.length; i++) {
    const f = formMatches[i];
    if (f[0].includes('method="get"') || (f[0].includes('action="."') && i === formMatches.length - 1)) {
      mainFormStart = f.index;
      break;
    }
  }
  if (mainFormStart === -1 && formMatches.length > 0) {
    mainFormStart = formMatches[formMatches.length - 1].index;
  }

  if (presetsStart !== -1 && mainFormStart !== -1) {
    const rawPresets = html.substring(presetsStart, mainFormStart).trim();
    sections['presets.html'] = applyExclusions('presets', rawPresets);
  }

  // 3. Main Form TR Sections
  const mainFormEnd = html.indexOf('</form>', mainFormStart);
  const mainFormHtml = html.substring(mainFormStart, mainFormEnd !== -1 ? mainFormEnd + 7 : undefined);
  const trs = extractTableRows(mainFormHtml);

  for (let i = 0; i < trs.length; i++) {
    const fileName = SECTION_FILES[i] || `section_${String(i + 1).padStart(2, '0')}.html`;
    sections[fileName] = applyExclusions(fileName, trs[i]);
  }

  return { upstreamCommit, sections };
}

/**
 * Extracts form field names from HTML to summarize differences.
 */
function extractFieldNames(html) {
  const fields = new Set();
  const nameRegex = /\bname="([^"]+)"/g;
  let m;
  while ((m = nameRegex.exec(html)) !== null) {
    fields.add(m[1]);
  }
  return fields;
}

/**
 * Compares current parsed sections with baseline cache.
 */
function compareWithCache(currentSections, cacheDir) {
  const diffReport = {
    hasChanges: false,
    modifiedSections: [],
    addedSections: [],
    removedSections: []
  };

  const cachedFiles = fs.existsSync(cacheDir)
    ? fs.readdirSync(cacheDir).filter(f => f.endsWith('.html'))
    : [];

  const currentKeys = Object.keys(currentSections);

  // Check for modified and added
  for (const file of currentKeys) {
    const currentHtml = currentSections[file];
    const cacheFilePath = path.join(cacheDir, file);

    if (!fs.existsSync(cacheFilePath)) {
      diffReport.hasChanges = true;
      diffReport.addedSections.push({
        file,
        fields: Array.from(extractFieldNames(currentHtml))
      });
    } else {
      const cachedHtml = normalizeHtml(fs.readFileSync(cacheFilePath, 'utf8'));
      if (cachedHtml !== currentHtml) {
        diffReport.hasChanges = true;

        const currentFields = extractFieldNames(currentHtml);
        const cachedFields = extractFieldNames(cachedHtml);

        const addedFields = [...currentFields].filter(f => !cachedFields.has(f));
        const removedFields = [...cachedFields].filter(f => !currentFields.has(f));

        diffReport.modifiedSections.push({
          file,
          addedFields,
          removedFields
        });
      }
    }
  }

  // Check for removed
  for (const file of cachedFiles) {
    if (!currentSections[file]) {
      diffReport.hasChanges = true;
      diffReport.removedSections.push(file);
    }
  }

  return diffReport;
}


/**
 * Generates PR body markdown based on diff report.
 */
function generatePrReport(upstreamCommit, diffReport) {
  const lines = [];
  lines.push(`## 🚀 本家サイトの更新を検知しました (本家コミット: \`${upstreamCommit}\`)`);
  lines.push('');
  lines.push('以下のセクションに変更があります。取り込む項目を確認・翻訳してマージしてください。');
  lines.push('');
  lines.push('### 変更のあったセクション');

  if (diffReport.modifiedSections.length === 0 && diffReport.addedSections.length === 0) {
    lines.push('- 検出された差分はありません（同期済み）');
  }

  for (const sec of diffReport.modifiedSections) {
    lines.push(`- [ ] \`${sec.file}\`:`);
    if (sec.addedFields.length > 0) {
      lines.push(`  - 追加された設定項目: \`${sec.addedFields.join('`, `')}\``);
    }
    if (sec.removedFields.length > 0) {
      lines.push(`  - 削除・廃止された設定項目: \`${sec.removedFields.join('`, `')}\``);
    }
    if (sec.addedFields.length === 0 && sec.removedFields.length === 0) {
      lines.push(`  - 内部マークアップ・推奨値等の更新`);
    }
  }

  for (const sec of diffReport.addedSections) {
    lines.push(`- [ ] 新規セクション検知: \`${sec.file}\` (フィールド数: ${sec.fields.length})`);
  }

  if (diffReport.removedSections.length > 0) {
    for (const file of diffReport.removedSections) {
      lines.push(`- [ ] 削除されたセクション: \`${file}\``);
    }
  }

  lines.push('');
  lines.push('### 関連チェック');
  lines.push('- [ ] C# 側の生成エンジン (`modifier/*.cs` / `Main.cs`) との整合性確認');
  lines.push('- [ ] 対応する JS エンジン (`docs/js/` / `docs/unattend_engine.js`) へのロジック反映');
  lines.push('- [ ] `npm test` またはパリティテストによる動作検証');
  lines.push('');

  return lines.join('\n');
}

/**
 * Main execution routing.
 */
async function main() {
  const args = process.argv.slice(2);
  const isCheck = args.includes('--check');
  const isUpdateCache = args.includes('--update-cache');
  const isUpdateDocs = args.includes('--update-docs');
  const isFromCache = args.includes('--from-cache');
  const forceReport = args.includes('--force-report');
  const reportIndex = args.indexOf('--report');
  const reportPath = reportIndex !== -1 ? args[reportIndex + 1] : null;
  const fileIndex = args.indexOf('--file');
  const inputFilePath = fileIndex !== -1 ? args[fileIndex + 1] : null;
  const urlIndex = args.indexOf('--url');
  const targetUrl = urlIndex !== -1 ? args[urlIndex + 1] : defaultUrl;

  console.log('=== Schneegans Upstream Site Sync ===');

  let upstreamCommit = 'latest';
  let sections = {};

  if (isFromCache) {
    console.log(`Reading sections from cache: ${cacheDir}`);
    if (!fs.existsSync(cacheDir)) {
      throw new Error(`Cache directory not found: ${cacheDir}`);
    }
    const cachedFiles = fs.readdirSync(cacheDir).filter(f => f.endsWith('.html'));
    for (const file of cachedFiles) {
      sections[file] = fs.readFileSync(path.join(cacheDir, file), 'utf8');
    }
    console.log(`Loaded ${Object.keys(sections).length} sections from cache.`);
  } else {
    let rawHtml = '';
    if (inputFilePath) {
      console.log(`Reading HTML from file: ${inputFilePath}`);
      rawHtml = fs.readFileSync(path.resolve(inputFilePath), 'utf8');
    } else {
      console.log(`Fetching upstream HTML from: ${targetUrl}`);
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch upstream site: HTTP ${response.status} ${response.statusText}`);
      }
      rawHtml = await response.text();
    }

    console.log(`Parsing HTML (${rawHtml.length} bytes)...`);
    const parsed = parseUpstreamHtml(rawHtml);
    upstreamCommit = parsed.upstreamCommit;
    sections = parsed.sections;
    console.log(`Upstream Commit Hash: ${upstreamCommit}`);
    console.log(`Parsed ${Object.keys(sections).length} sections.`);
  }

  // Compare with cache (only if not running --from-cache)
  const diffReport = compareWithCache(sections, cacheDir);

  if (!isFromCache) {
    console.log('\n--- Sync Status ---');
    console.log(`Has Changes      : ${diffReport.hasChanges}`);
    console.log(`Modified Sections: ${diffReport.modifiedSections.length}`);
    console.log(`Added Sections   : ${diffReport.addedSections.length}`);
    console.log(`Removed Sections : ${diffReport.removedSections.length}`);

    if (diffReport.modifiedSections.length > 0) {
      for (const mod of diffReport.modifiedSections) {
        console.log(`  - Modified: ${mod.file} (+[${mod.addedFields.join(', ')}] -[${mod.removedFields.join(', ')}])`);
      }
    }
  }

  // Update cache if requested
  if (isUpdateCache) {
    console.log(`\nUpdating cache in: ${cacheDir}`);
    fs.mkdirSync(cacheDir, { recursive: true });
    for (const [file, content] of Object.entries(sections)) {
      fs.writeFileSync(path.join(cacheDir, file), content, 'utf8');
    }
    console.log('Cache updated successfully.');
  }

  // Update docs sections if requested
  if (isUpdateDocs) {
    console.log(`\nUpdating docs sections in: ${docsSectionsDir}`);
    fs.mkdirSync(docsSectionsDir, { recursive: true });

    const updateAll = args.includes('--all');
    let targetFiles = Object.keys(sections);
    if (!updateAll && diffReport.hasChanges && (diffReport.modifiedSections.length > 0 || diffReport.addedSections.length > 0)) {
      const changed = new Set([
        ...diffReport.modifiedSections.map(m => m.file),
        ...diffReport.addedSections.map(a => a.file)
      ]);
      targetFiles = targetFiles.filter(f => changed.has(f));
    }

    for (const file of targetFiles) {
      const content = sections[file];
      if (!content) continue;
      const targetPath = path.join(docsSectionsDir, file);
      const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
      const docsContent = postProcessForDocs(file, content, existing);
      fs.writeFileSync(targetPath, docsContent, 'utf8');
      console.log(`  - Updated: ${file}`);
    }
    console.log('Docs sections updated successfully.');
  }

  // Generate PR report if requested
  if (reportPath && (diffReport.hasChanges || forceReport)) {
    const reportMd = generatePrReport(upstreamCommit, diffReport);
    fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
    fs.writeFileSync(path.resolve(reportPath), reportMd, 'utf8');
    console.log(`PR Report generated at: ${reportPath}`);
  }

  if (isCheck) {
    if (diffReport.hasChanges) {
      console.log('\nResult: Upstream differences detected!');
      process.exit(1);
    } else {
      console.log('\nResult: Upstream is in sync with cache.');
      process.exit(0);
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  SECTION_FILES,
  normalizeHtml,
  extractTableRows,
  applyExclusions,
  ensureTranslateAttributes,
  protectImageWords,
  postProcessForDocs,
  parseUpstreamHtml,
  compareWithCache,
  generatePrReport
};

