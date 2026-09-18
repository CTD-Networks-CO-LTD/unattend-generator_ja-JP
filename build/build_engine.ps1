# Bundles modular JavaScript files under docs/js/ into docs/unattend_engine.js
[CmdletBinding()]
param(
  [string]$OutputFile = "$PSScriptRoot/../docs/unattend_engine.js"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path "$PSScriptRoot/..").Path
$docsJs = Join-Path $repoRoot "docs/js"
$targetPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $OutputFile))
$constantsPath = Join-Path $docsJs "core/constants.js"
$baselinePath = Join-Path $repoRoot "test_tools/baseline_unattend_engine.js"
$headerPath = Join-Path $repoRoot "docs/sections/header.html"


# 1. Determine commit hash
$commitHash = $env:COMMIT_HASH
if (-not $commitHash) { $commitHash = $env:GITHUB_SHA }
if (-not $commitHash) {
  try {
    $commitHash = (git -C $repoRoot rev-parse HEAD 2>$null).Trim()
  } catch {}
}

# 2. Determine repository URL
$repoUrl = $env:REPO_URL
if (-not $repoUrl) {
  try {
    $rawUrl = (git -C $repoRoot config --get remote.origin.url 2>$null).Trim()
    if ($rawUrl) {
      if ($rawUrl.StartsWith("git@github.com:")) {
        $rawUrl = "https://github.com/" + $rawUrl.Substring("git@github.com:".Length)
      }
      if ($rawUrl.EndsWith(".git")) {
        $rawUrl = $rawUrl.Substring(0, $rawUrl.Length - 4)
      }
      $repoUrl = $rawUrl
    }
  } catch {}
}
if (-not $repoUrl) {
  $repoUrl = "https://github.com/CTD-Networks-CO-LTD/unattend-generator_ja-JP"
}
$repoUrl = $repoUrl.TrimEnd('/')
$commitUrlBase = "$repoUrl/commit/"
# 3. Determine release tag and release URL
$releaseTag = $env:RELEASE_TAG
if (-not $releaseTag) {
  try {
    $tags = (git -C $repoRoot tag -l "v*" --sort=-v:refname 2>$null)
    if ($tags) {
      $releaseTag = ($tags | Select-Object -First 1).Trim()
    }
  } catch {}
}
if (-not $releaseTag) {
  try {
    $releaseTag = (git -C $repoRoot describe --tags --abbrev=0 2>$null).Trim()
  } catch {}
}
if (-not $releaseTag) {
  $releaseTag = "v1.3.0_20260918"
}
$releaseUrl = if ($releaseTag) { "$repoUrl/releases/tag/$releaseTag" } else { "$repoUrl/releases" }

# 4. Determine commit date
$commitDate = $env:COMMIT_DATE
if (-not $commitDate) {
  try {
    $commitDate = (git -C $repoRoot log -1 --format=%cI 2>$null).Trim()
  } catch {}
}
if (-not $commitDate) {
  $commitDate = "2026-09-18T16:53:54+09:00"
}

$shortHash = if ($commitHash -and $commitHash.Length -ge 7) { $commitHash.Substring(0, 7) } else { "e7197cb" }
$commitUrl = if ($commitHash) { "$commitUrlBase$commitHash" } else { "$commitUrlBase$shortHash" }


Write-Host "Build Environment:"
Write-Host "  Repo URL    : $repoUrl"
Write-Host "  Commit Hash : $(if ($commitHash) { $commitHash } else { '(unchanged)' })"
Write-Host "  Release Tag : $releaseTag"
Write-Host "  Commit Date : $commitDate"


# 3. Synchronize docs/js/core/constants.js
if (Test-Path $constantsPath) {
  $cText = [System.IO.File]::ReadAllText($constantsPath, [System.Text.Encoding]::UTF8)
  if ($repoUrl) {
    $cText = $cText -replace "var REPO_URL = '[^']*';", "var REPO_URL = '$repoUrl';"
    $cText = $cText -replace "var COMMIT_URL_BASE = [^;]*;", "var COMMIT_URL_BASE = REPO_URL + '/commit/';"
  }
  if ($commitHash) {
    $cText = $cText -replace "var COMMIT_HASH = '[^']*';", "var COMMIT_HASH = '$commitHash';"
  }
  if ($releaseTag) {
    $cText = $cText -replace "var RELEASE_TAG = '[^']*';", "var RELEASE_TAG = '$releaseTag';"
    $cText = $cText -replace "var RELEASE_URL = [^;]*;", "var RELEASE_URL = '$releaseUrl';"
  }
  if ($commitDate) {
    $cText = $cText -replace "var COMMIT_DATE = '[^']*';", "var COMMIT_DATE = '$commitDate';"
  }

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($constantsPath, $cText, $utf8NoBom)
  Write-Host "  -> Synchronized $constantsPath"
}

# 4. Synchronize test_tools/baseline_unattend_engine.js
if (Test-Path $baselinePath) {
  $bText = [System.IO.File]::ReadAllText($baselinePath, [System.Text.Encoding]::UTF8)
  if ($commitHash) {
    $bText = $bText -replace "var commitHash = '[^']*';", "var commitHash = '$commitHash';"
  }
  if ($repoUrl) {
    $bText = $bText -replace "https://github\.com/[^/]+/[^/]+/commit/", $commitUrlBase
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($baselinePath, $bText, $utf8NoBom)
  Write-Host "  -> Synchronized $baselinePath"
}
# 5. Synchronize docs/sections/header.html
if (Test-Path $headerPath) {
  $hText = [System.IO.File]::ReadAllText($headerPath, [System.Text.Encoding]::UTF8)
  if ($repoUrl) {
    $hText = $hText -replace '<a href="https://github\.com/[^"]+">GitHub</a>', "<a href=""$repoUrl"">GitHub</a>"
  }
  if ($releaseTag -and $releaseUrl) {
    $hText = $hText -replace '<a id="header-release-link" href="[^"]*">[^<]*</a>', "<a id=""header-release-link"" href=""$releaseUrl"">$releaseTag</a>"
  }
  if ($shortHash -and $commitUrl) {
    $hText = $hText -replace '<a id="header-commit-link" href="[^"]*">[^<]*</a>', "<a id=""header-commit-link"" href=""$commitUrl"">$shortHash</a>"
  }
  if ($commitDate) {
    $hText = $hText -replace '<span id="header-commit-time" data-commit-date="[^"]*">', "<span id=""header-commit-time"" data-commit-date=""$commitDate"">"
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($headerPath, $hText, $utf8NoBom)
  Write-Host "  -> Synchronized $headerPath"
}


Write-Host "Bundling Unattend Engine modules from $docsJs..."

$moduleFiles = @(
  # Core files
  "core/config.js",
  "core/constants.js",
  "core/iso_builder.js",
  "core/xml_node.js",
  "core/powershell_sequence.js",
  "core/generation_context.js",

  # Modifiers
  "modifiers/locales.js",
  "modifiers/bypass.js",
  "modifiers/product_key.js",
  "modifiers/computer_name.js",
  "modifiers/password_expiration.js",
  "modifiers/lockout.js",
  "modifiers/time_zone.js",
  "modifiers/express_settings.js",
  "modifiers/users.js",
  "modifiers/delete.js",
  "modifiers/optimizations.js",
  "modifiers/bloatware.js",
  "modifiers/wifi.js",
  "modifiers/scripts.js",
  "modifiers/build.js",

  # Generator Engine
  "generator_engine.js",

  # UI and Bridge
  "ui/form_bridge.js",
  "ui/event_listener.js",

  # Index & Exporter
  "index.js"
)

$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine("/**")
[void]$sb.AppendLine(" * Unattend Generator Engine (Modular Bundle)")
[void]$sb.AppendLine(" * Auto-generated by build/build_engine.ps1 - DO NOT EDIT DIRECTLY")
[void]$sb.AppendLine(" */")
[void]$sb.AppendLine("(function (global) {")
[void]$sb.AppendLine("  'use strict';")
[void]$sb.AppendLine("")

foreach ($relPath in $moduleFiles) {
  $fullPath = Join-Path $docsJs $relPath
  if (-not (Test-Path $fullPath)) {
    throw "Module file not found: $fullPath"
  }
  Write-Host "  -> Including $relPath"
  $content = [System.IO.File]::ReadAllText($fullPath, [System.Text.Encoding]::UTF8)
  [void]$sb.AppendLine("  // --- Begin: $relPath ---")
  [void]$sb.AppendLine($content)
  [void]$sb.AppendLine("  // --- End: $relPath ---")
  [void]$sb.AppendLine("")
}

[void]$sb.AppendLine("})(typeof window !== 'undefined' ? window : globalThis);")

# Normalize line endings to CRLF
$result = $sb.ToString() -replace "`r?`n", "`r`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($targetPath, $result, $utf8NoBom)

Write-Host "Successfully generated $targetPath ($(($result | Measure-Object -Character).Characters) characters)."
