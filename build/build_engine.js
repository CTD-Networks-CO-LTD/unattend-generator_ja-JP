/**
 * Cross-platform Bundler for Unattend Engine
 * Usage: node build/build_engine.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const docsJs = path.join(repoRoot, 'docs', 'js');
const targetPath = path.join(repoRoot, 'docs', 'unattend_engine.js');
const constantsPath = path.join(docsJs, 'core', 'constants.js');
const baselinePath = path.join(repoRoot, 'test_tools', 'baseline_unattend_engine.js');
const headerPath = path.join(repoRoot, 'docs', 'sections', 'header.html');


// 1. Determine commit hash
let commitHash = process.env.COMMIT_HASH || process.env.GITHUB_SHA || '';
if (!commitHash) {
  try {
    commitHash = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (e) {
    console.warn('Warning: Could not get commit hash from git:', e.message);
  }
}

// 2. Determine repository URL
let repoUrl = process.env.REPO_URL || '';
if (!repoUrl) {
  try {
    let rawUrl = execSync('git config --get remote.origin.url', { cwd: repoRoot, encoding: 'utf8' }).trim();
    if (rawUrl) {
      if (rawUrl.startsWith('git@github.com:')) {
        rawUrl = 'https://github.com/' + rawUrl.substring('git@github.com:'.length);
      }
      if (rawUrl.endsWith('.git')) {
        rawUrl = rawUrl.substring(0, rawUrl.length - 4);
      }
      repoUrl = rawUrl;
    }
  } catch (e) {
    // ignore
  }
}
if (!repoUrl) {
  repoUrl = 'https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP';
}
repoUrl = repoUrl.replace(/\/+$/, '');
const commitUrlBase = repoUrl + '/commit/';
// 3. Determine release tag and release URL
let releaseTag = process.env.RELEASE_TAG || '';
if (!releaseTag) {
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
    releaseTag = process.env.GITHUB_REF_NAME;
  }
}
if (!releaseTag) {
  try {
    const tagOutput = execSync('git tag -l "v*" --sort=-v:refname', { cwd: repoRoot, encoding: 'utf8' }).trim();
    const tags = tagOutput.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
    if (tags.length > 0) {
      releaseTag = tags[0];
    }
  } catch (e) {}
}
if (!releaseTag) {
  try {
    releaseTag = execSync('git describe --tags --abbrev=0', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (e) {}
}
if (!releaseTag) {
  releaseTag = 'v1.4.0_20260919';
}
const releaseUrl = releaseTag ? (repoUrl + '/releases/tag/' + releaseTag) : (repoUrl + '/releases');

// 4. Determine commit date
let commitDate = process.env.COMMIT_DATE || '';
if (!commitDate) {
  try {
    commitDate = execSync('git log -1 --format=%cI', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (e) {}
}
if (!commitDate) {
  commitDate = '2026-09-18T16:53:54+09:00';
}

const shortHash = commitHash ? commitHash.substring(0, 7) : 'e7197cb';
const commitUrl = commitUrlBase + (commitHash || shortHash);


console.log('Build Environment:');
console.log('  Repo URL    : ' + repoUrl);
console.log('  Commit Hash : ' + (commitHash || '(unchanged)'));

console.log('  Release Tag : ' + releaseTag);
console.log('  Commit Date : ' + commitDate);

// 3. Synchronize docs/js/core/constants.js
if (fs.existsSync(constantsPath)) {
  let constantsContent = fs.readFileSync(constantsPath, 'utf8');
  if (repoUrl) {
    constantsContent = constantsContent.replace(
      /var REPO_URL = '[^']*';/,
      "var REPO_URL = '" + repoUrl + "';"
    );
    constantsContent = constantsContent.replace(
      /var COMMIT_URL_BASE = [^;]*;/,
      "var COMMIT_URL_BASE = REPO_URL + '/commit/';"
    );
  }
  if (commitHash) {
    constantsContent = constantsContent.replace(
      /var COMMIT_HASH = '[^']*';/,
      "var COMMIT_HASH = '" + commitHash + "';"
    );
  }
  if (releaseTag) {
    constantsContent = constantsContent.replace(
      /var RELEASE_TAG = '[^']*';/,
      "var RELEASE_TAG = '" + releaseTag + "';"
    );
    constantsContent = constantsContent.replace(
      /var RELEASE_URL = [^;]*;/,
      "var RELEASE_URL = '" + releaseUrl + "';"
    );
  }
  if (commitDate) {
    constantsContent = constantsContent.replace(
      /var COMMIT_DATE = '[^']*';/,
      "var COMMIT_DATE = '" + commitDate + "';"
    );
  }

  fs.writeFileSync(constantsPath, constantsContent, 'utf8');
  console.log('  -> Synchronized ' + constantsPath);
}

// 4. Synchronize test_tools/baseline_unattend_engine.js
if (fs.existsSync(baselinePath)) {
  let baselineContent = fs.readFileSync(baselinePath, 'utf8');
  if (commitHash) {
    baselineContent = baselineContent.replace(
      /var commitHash = '[^']*';/,
      "var commitHash = '" + commitHash + "';"
    );
  }
  if (repoUrl) {
    baselineContent = baselineContent.replace(
      /https:\/\/github\.com\/[^/]+\/[^/]+\/commit\//g,
      commitUrlBase
    );
  }
  fs.writeFileSync(baselinePath, baselineContent, 'utf8');
  console.log('  -> Synchronized ' + baselinePath);
}
// 5. Synchronize docs/sections/header.html
if (fs.existsSync(headerPath)) {
  let headerContent = fs.readFileSync(headerPath, 'utf8');
  if (repoUrl) {
    headerContent = headerContent.replace(
      /<a href="https:\/\/github\.com\/[^"]+">GitHub<\/a>/,
      '<a href="' + repoUrl + '">GitHub</a>'
    );
  }
  if (releaseTag && releaseUrl) {
    headerContent = headerContent.replace(
      /<a id="header-release-link" href="[^"]*">[^<]*<\/a>/,
      '<a id="header-release-link" href="' + releaseUrl + '">' + releaseTag + '</a>'
    );
  }
  if (shortHash && commitUrl) {
    headerContent = headerContent.replace(
      /<a id="header-commit-link" href="[^"]*">[^<]*<\/a>/,
      '<a id="header-commit-link" href="' + commitUrl + '">' + shortHash + '</a>'
    );
  }
  if (commitDate) {
    headerContent = headerContent.replace(
      /<span id="header-commit-time" data-commit-date="[^"]*">/,
      '<span id="header-commit-time" data-commit-date="' + commitDate + '">'
    );
  }
  fs.writeFileSync(headerPath, headerContent, 'utf8');
  console.log('  -> Synchronized ' + headerPath);
}


console.log('Bundling Unattend Engine modules from ' + docsJs + '...');

const moduleFiles = [
  // Core files
  'core/config.js',
  'core/constants.js',
  'core/iso_builder.js',
  'core/xml_node.js',
  'core/powershell_sequence.js',
  'core/generation_context.js',

  // Modifiers
  'modifiers/locales.js',
  'modifiers/bypass.js',
  'modifiers/product_key.js',
  'modifiers/computer_name.js',
  'modifiers/password_expiration.js',
  'modifiers/lockout.js',
  'modifiers/time_zone.js',
  'modifiers/express_settings.js',
  'modifiers/users.js',
  'modifiers/delete.js',
  'modifiers/optimizations.js',
  'modifiers/bloatware.js',
  'modifiers/wifi.js',
  'modifiers/scripts.js',
  'modifiers/build.js',

  // Generator Engine
  'generator_engine.js',

  // UI and Bridge
  'ui/form_bridge.js',
  'ui/event_listener.js',

  // Index & Exporter
  'index.js'
];

let bundle = '/**\r\n' +
  ' * Unattend Generator Engine (Modular Bundle)\r\n' +
  ' * Auto-generated by build/build_engine.js - DO NOT EDIT DIRECTLY\r\n' +
  ' */\r\n' +
  '(function (global) {\r\n' +
  "  'use strict';\r\n\r\n";

for (const relPath of moduleFiles) {
  const fullPath = path.join(docsJs, ...relPath.split('/'));
  if (!fs.existsSync(fullPath)) {
    throw new Error('Module file not found: ' + fullPath);
  }
  console.log('  -> Including ' + relPath);
  let content = fs.readFileSync(fullPath, 'utf8');
  // Normalize CRLF
  content = content.replace(/\r?\n/g, '\r\n');
  bundle += '  // --- Begin: ' + relPath + ' ---\r\n';
  bundle += content + '\r\n';
  bundle += '  // --- End: ' + relPath + ' ---\r\n\r\n';
}

bundle += '})(typeof window !== \'undefined\' ? window : globalThis);\r\n';

fs.writeFileSync(targetPath, bundle, 'utf8');
console.log('Successfully generated ' + targetPath + ' (' + bundle.length + ' chars).');
