<#
.SYNOPSIS
    マウント済みVMディスク（オフライン）自動検収ツール
.DESCRIPTION
    VMシャットダウン後にホストへマウントされた仮想ディスク（既定 E:\）を対象に、
    セットアップログ、コンピュータ名、ユーザープロファイル、機密ファイル抹消、スクリプト実行結果を自動検証します。
#>

param(
    [string]$MountDrive = "E:\",
    [string]$ExpectedUser = "admin",
    [string]$ExpectedComputerNamePattern = "^PC-\d{8}$"
)

$ErrorActionPreference = "Continue"
$passCount = 0
$failCount = 0
$warnCount = 0

function Report-Pass {
    param([string]$Msg)
    Write-Host " [PASS] $Msg" -ForegroundColor Green
    $script:passCount++
}

function Report-Fail {
    param([string]$Msg)
    Write-Host " [FAIL] $Msg" -ForegroundColor Red
    $script:failCount++
}

function Report-Warn {
    param([string]$Msg)
    Write-Host " [WARN] $Msg" -ForegroundColor Yellow
    $script:warnCount++
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  VM Disk Offline Verification Tool" -ForegroundColor Cyan
Write-Host "  Target Drive: $MountDrive" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. ドライブ存在確認
if (-not (Test-Path $MountDrive)) {
    Report-Fail "Target disk mount path not found: $MountDrive"
    Write-Host "`nSummary: Pass: $passCount, Fail: $failCount, Warn: $warnCount" -ForegroundColor Yellow
    exit 1
}
Report-Pass "Target disk is mounted at $MountDrive"

# 2. Panther セットアップエラーログ
$pantherErrLog = Join-Path $MountDrive "Windows\Panther\setuperr.log"
if (Test-Path $pantherErrLog) {
    $pantherErrors = Get-Content -LiteralPath $pantherErrLog -Encoding UTF8 | Where-Object { $_ -match "Fatal|Rollback" }
    if ($pantherErrors) {
        Report-Fail "Fatal errors found in Panther\setuperr.log: $($pantherErrors.Count) line(s)"
    } else {
        Report-Pass "Panther setuperr.log has no fatal rollback errors."
    }
} else {
    Report-Pass "Panther setuperr.log does not exist (clean install)."
}

# 3. Setup Scripts ログのエラー検知
$scriptsDir = Join-Path $MountDrive "Windows\Setup\Scripts"
if (Test-Path $scriptsDir) {
    $logs = Get-ChildItem -Path $scriptsDir -Filter "*.log"
    foreach ($log in $logs) {
        $errMatches = Select-String -Path $log.FullName -Pattern "ParserError|ParseException|TerminatorExpected|予期しないトークン|エラー" -Encoding UTF8
        if ($errMatches) {
            Report-Fail "Syntax/Script errors found in $($log.Name): $($errMatches.Count) occurrences"
            $errMatches | Select-Object -First 5 | ForEach-Object {
                Write-Host "    Line $($_.LineNumber): $($_.Line.Trim())" -ForegroundColor DarkRed
            }
        } else {
            Report-Pass "No parser errors in $($log.Name)"
        }
    }
} else {
    Report-Warn "Setup scripts directory not found: $scriptsDir"
}

# 4. コンピュータ名検証
$compTxt = Join-Path $MountDrive "Windows\Setup\Scripts\ComputerName.txt"
if (Test-Path $compTxt) {
    $name = (Get-Content -Path $compTxt -Raw -Encoding UTF8).Trim()
    if ($name -match $ExpectedComputerNamePattern) {
        Report-Pass "ComputerName matches pattern: $name"
    } else {
        Report-Warn "ComputerName '$name' does not match pattern '$ExpectedComputerNamePattern'"
    }
} else {
    Report-Warn "ComputerName.txt not found at $compTxt"
}

# 5. ユーザープロファイル検証
$userDir = Join-Path $MountDrive "Users\$ExpectedUser"
if (Test-Path $userDir) {
    Report-Pass "User profile exists: $userDir"
} else {
    Report-Warn "User profile directory not found: $userDir"
}

# 6. 機密ファイル（平文 unattend.xml）消去確認
$pantherXml = Join-Path $MountDrive "Windows\Panther\unattend.xml"
if (-not (Test-Path $pantherXml)) {
    Report-Pass "Panther unattend.xml is deleted (credentials protected)."
} else {
    Report-Fail "Panther unattend.xml still exists! Plaintext password exposure risk."
}

# 7. FirstLogon ログ完了確認
$firstLogonLog = Join-Path $MountDrive "Windows\Setup\Scripts\FirstLogon.log"
if (Test-Path $firstLogonLog) {
    Report-Pass "FirstLogon.log exists (FirstLogon execution confirmed)."
} else {
    Report-Warn "FirstLogon.log not found."
}

# 8. DefaultUser.ps1 内のスマートクォート検査
$defaultUserPs1 = Join-Path $MountDrive "Windows\Setup\Scripts\DefaultUser.ps1"
if (Test-Path $defaultUserPs1) {
    $duContent = Get-Content -LiteralPath $defaultUserPs1 -Raw -Encoding UTF8
    if ($duContent -match "[\u2018\u2019\u201C\u201D]") {
        Report-Fail "Typographic quote (’) still present in $defaultUserPs1 !"
    } else {
        Report-Pass "No typographic quotes in $defaultUserPs1"
    }
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host " Test Summary: Pass = $passCount, Fail = $failCount, Warn = $warnCount" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

if ($failCount -gt 0) {
    exit 1
}
exit 0
