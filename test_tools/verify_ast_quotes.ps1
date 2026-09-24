<#
.SYNOPSIS
    autounattend.xml または PowerShell スクリプトファイル群の AST 構文解析およびスマートクォート検出ツール
.DESCRIPTION
    XML 内の <File> タグに含まれる全スクリプト、またはローカル/VM上の .ps1 ファイルに対して
    PowerShell AST パーサーを実行し、構文エラーや全角タイポグラフィッククォート（U+2018, U+2019, U+201C, U+201D）を自動検出します。
#>

param(
    [string]$XmlPath = "",
    [string]$ScriptDir = "",
    [switch]$FailOnWarning
)

$ErrorActionPreference = "Stop"
$globalErrorCount = 0
$globalWarningCount = 0

function Test-ScriptContent {
    param(
        [string]$Name,
        [string]$Content
    )

    Write-Host "`n--- Checking: $Name ---" -ForegroundColor Cyan
    $localHasError = $false

    # 1. タイポグラフィッククォート（スマートクォート）の検査
    $quoteMatches = [regex]::Matches($Content, "[\u2018\u2019\u201C\u201D]")
    if ($quoteMatches.Count -gt 0) {
        Write-Warning "[WARN] Detected $($quoteMatches.Count) typographic quote(s) in: $Name"
        $lines = $Content -split "\r?\n"
        for ($i = 0; $i -lt $lines.Length; $i++) {
            if ($lines[$i] -match "[\u2018\u2019\u201C\u201D]") {
                Write-Warning "  Line $($i + 1): $($lines[$i].Trim())"
            }
        }
        $script:globalWarningCount += $quoteMatches.Count
        if ($FailOnWarning) {
            $localHasError = $true
        }
    } else {
        Write-Host " [PASS] No typographic quotes found." -ForegroundColor Green
    }

    # 2. PowerShell AST 構文解析（.ps1 スクリプトのみ）
    if ($Name.EndsWith('.ps1', [System.StringComparison]::OrdinalIgnoreCase) -or (-not [System.IO.Path]::HasExtension($Name))) {
        $errors = $null
        $tokens = $null
        [System.Management.Automation.Language.Parser]::ParseInput($Content, [ref]$tokens, [ref]$errors) | Out-Null

        if ($errors -and $errors.Count -gt 0) {
            Write-Error "[FAIL] Parse errors detected in: $Name"
            foreach ($err in $errors) {
                Write-Host "  Line $($err.Extent.StartLineNumber), Col $($err.Extent.StartColumnNumber): $($err.Message)" -ForegroundColor Red
            }
            $script:globalErrorCount += $errors.Count
            $localHasError = $true
        } else {
            Write-Host " [PASS] PowerShell AST Syntax OK." -ForegroundColor Green
        }
    }

    return -not $localHasError
}

Write-Host "==================================================" -ForegroundColor Yellow
Write-Host "  PowerShell AST & Quote Verification Tool" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow

# XML ファイルが指定された場合、またはデフォルト探索
if ($XmlPath -and (Test-Path $XmlPath)) {
    Write-Host "`nInspecting XML: $XmlPath" -ForegroundColor Magenta
    [xml]$xml = Get-Content -LiteralPath $XmlPath -Raw -Encoding UTF8
    
    # unattend.Extensions.File の検査
    $files = $xml.unattend.Extensions.File
    if ($files) {
        foreach ($file in $files) {
            $path = $file.GetAttribute('path')
            $content = $file.InnerText.Trim()
            Test-ScriptContent -Name $path -Content $content | Out-Null
        }
    }
}

# ディレクトリまたはファイルパスが指定された場合
if ($ScriptDir -and (Test-Path $ScriptDir)) {
    if ((Get-Item $ScriptDir) -is [System.IO.DirectoryInfo]) {
        Write-Host "`nInspecting Directory: $ScriptDir" -ForegroundColor Magenta
        $psFiles = Get-ChildItem -Path $ScriptDir -Filter "*.ps1"
        foreach ($f in $psFiles) {
            $content = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8
            Test-ScriptContent -Name $f.FullName -Content $content | Out-Null
        }
    } else {
        Write-Host "`nInspecting Single File: $ScriptDir" -ForegroundColor Magenta
        $content = Get-Content -LiteralPath $ScriptDir -Raw -Encoding UTF8
        Test-ScriptContent -Name $ScriptDir -Content $content | Out-Null
    }
}

Write-Host "`n==================================================" -ForegroundColor Yellow
Write-Host " Summary: Errors = $globalErrorCount, Warnings = $globalWarningCount" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Yellow

if ($globalErrorCount -gt 0 -or ($FailOnWarning -and $globalWarningCount -gt 0)) {
    exit 1
}
exit 0
