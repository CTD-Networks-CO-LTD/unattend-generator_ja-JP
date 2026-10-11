/**
 * Synchronize Release Tag and Commit Metadata for Staged Tag Docs
 * Usage: node build/sync_tag_docs.js <targetDir> <latestTag> [tagCommit] [repoFull]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const targetDir = process.argv[2] || process.env.TARGET_DIR || '_tag_clean';
const latestTag = process.argv[3] || process.env.LATEST_TAG || '';
let tagCommit = process.argv[4] || process.env.TAG_COMMIT || '';
let repoFull = process.argv[5] || process.env.REPO_FULL || '';

if (!latestTag) {
  console.warn('Warning: No latestTag provided to sync_tag_docs.js. Skipping synchronization.');
  process.exit(0);
}

// 1. Determine repository URL
if (!repoFull) {
  try {
    let rawUrl = execSync('git config --get remote.origin.url', { cwd: repoRoot, encoding: 'utf8' }).trim();
    if (rawUrl) {
      if (rawUrl.startsWith('git@github.com:')) {
        rawUrl = rawUrl.substring('git@github.com:'.length);
      } else if (rawUrl.startsWith('https://github.com/')) {
        rawUrl = rawUrl.substring('https://github.com/'.length);
      }
      if (rawUrl.endsWith('.git')) {
        rawUrl = rawUrl.substring(0, rawUrl.length - 4);
      }
      repoFull = rawUrl;
    }
  } catch (e) {
    // ignore
  }
}
if (!repoFull) {
  repoFull = 'CTD-Networks-CO-LTD/unattend-generator_ja-JP';
}
repoFull = repoFull.replace(/^\/+|\/+$/g, '');
const repoUrl = 'https://github.com/' + repoFull;
const releaseUrl = repoUrl + '/releases/tag/' + latestTag;

// 2. Determine tag commit hash and date
if (!tagCommit) {
  try {
    tagCommit = execSync('git rev-list -n 1 "' + latestTag + '"', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (e) {
    // ignore
  }
}

let tagShort = tagCommit ? tagCommit.substring(0, 7) : '';
let tagDate = '';
if (tagCommit) {
  try {
    tagDate = execSync('git log -1 --format=%cI "' + tagCommit + '"', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch (e) {
    // ignore
  }
}

const commitUrl = tagCommit ? (repoUrl + '/commit/' + tagCommit) : (repoUrl + '/commit/' + tagShort);

console.log('Synchronizing Tag Docs Metadata:');
console.log('  Target Dir  : ' + targetDir);
console.log('  Latest Tag  : ' + latestTag);
console.log('  Tag Commit  : ' + (tagCommit || '(unknown)'));
console.log('  Commit Date : ' + (tagDate || '(unknown)'));
console.log('  Repo URL    : ' + repoUrl);

const resolvedTarget = path.resolve(process.cwd(), targetDir);
if (!fs.existsSync(resolvedTarget)) {
  console.warn('Warning: Target directory does not exist: ' + resolvedTarget);
  process.exit(0);
}

// 3. Synchronize sections/header.html
const headerPath = path.join(resolvedTarget, 'sections', 'header.html');
if (fs.existsSync(headerPath)) {
  let content = fs.readFileSync(headerPath, 'utf8');

  // Replace GitHub repo link
  content = content.replace(
    /<a href="https:\/\/github\.com\/[^"]+">GitHub<\/a>/,
    '<a href="' + repoUrl + '">GitHub</a>'
  );

  // Replace Release tag link (attribute-order insensitive)
  content = content.replace(
    /<a id="header-release-link"[^>]*>[^<]*<\/a>/,
    '<a id="header-release-link" href="' + releaseUrl + '">' + latestTag + '</a>'
  );

  // Replace Commit link (attribute-order insensitive)
  if (tagShort && commitUrl) {
    content = content.replace(
      /<a id="header-commit-link"[^>]*>[^<]*<\/a>/,
      '<a id="header-commit-link" href="' + commitUrl + '">' + tagShort + '</a>'
    );
  }

  // Replace Commit time date
  if (tagDate) {
    content = content.replace(
      /<span id="header-commit-time" data-commit-date="[^"]*">/,
      '<span id="header-commit-time" data-commit-date="' + tagDate + '">'
    );
  }

  fs.writeFileSync(headerPath, content, 'utf8');
  console.log('  -> Synchronized ' + headerPath);
}

// 4. Synchronize js/core/constants.js
const constantsPath = path.join(resolvedTarget, 'js', 'core', 'constants.js');
if (fs.existsSync(constantsPath)) {
  let content = fs.readFileSync(constantsPath, 'utf8');
  content = content.replace(/var REPO_URL = '[^']*';/, "var REPO_URL = '" + repoUrl + "';");
  content = content.replace(/var COMMIT_URL_BASE = [^;]*;/, "var COMMIT_URL_BASE = REPO_URL + '/commit/';");
  content = content.replace(/var RELEASE_TAG = '[^']*';/, "var RELEASE_TAG = '" + latestTag + "';");
  content = content.replace(/var RELEASE_URL = [^;]*;/, "var RELEASE_URL = '" + releaseUrl + "';");
  if (tagCommit) {
    content = content.replace(/var COMMIT_HASH = '[^']*';/, "var COMMIT_HASH = '" + tagCommit + "';");
  }
  if (tagDate) {
    content = content.replace(/var COMMIT_DATE = '[^']*';/, "var COMMIT_DATE = '" + tagDate + "';");
  }
  fs.writeFileSync(constantsPath, content, 'utf8');
  console.log('  -> Synchronized ' + constantsPath);
}

// 5. Synchronize unattend_engine.js
const enginePath = path.join(resolvedTarget, 'unattend_engine.js');
if (fs.existsSync(enginePath)) {
  let content = fs.readFileSync(enginePath, 'utf8');
  content = content.replace(/var REPO_URL = '[^']*';/, "var REPO_URL = '" + repoUrl + "';");
  content = content.replace(/var COMMIT_URL_BASE = [^;]*;/, "var COMMIT_URL_BASE = REPO_URL + '/commit/';");
  content = content.replace(/var RELEASE_TAG = '[^']*';/, "var RELEASE_TAG = '" + latestTag + "';");
  content = content.replace(/var RELEASE_URL = [^;]*;/, "var RELEASE_URL = '" + releaseUrl + "';");
  if (tagCommit) {
    content = content.replace(/var COMMIT_HASH = '[^']*';/, "var COMMIT_HASH = '" + tagCommit + "';");
  }
  if (tagDate) {
    content = content.replace(/var COMMIT_DATE = '[^']*';/, "var COMMIT_DATE = '" + tagDate + "';");
  }
  fs.writeFileSync(enginePath, content, 'utf8');
  console.log('  -> Synchronized ' + enginePath);
}

console.log('Successfully completed tag docs synchronization.');
