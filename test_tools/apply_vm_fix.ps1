<#
.SYNOPSIS
    マウント済みVMディスク（E:\）の DefaultUser.ps1 修正適用スクリプト
.DESCRIPTION
    マウントされたVMディスクの DefaultUser.ps1 からスマートクォートを除去し、
    構文エラーを解消します。管理者権限（昇格）が必要です。
#>

param(
    [string]$TargetFile = "E:\Windows\Setup\Scripts\DefaultUser.ps1"
)

# 管理者権限の自己昇格チェック
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "管理者権限が必要です。昇格して再実行します..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -TargetFile `"$TargetFile`""
    exit 0
}

Write-Host "=== DefaultUser.ps1 修正適用処理 ===" -ForegroundColor Cyan

if (-not (Test-Path $TargetFile)) {
    Write-Error "対象ファイルが存在しません: $TargetFile"
    exit 1
}

# バックアップの作成
$backupFile = "$TargetFile.bak"
if (-not (Test-Path $backupFile)) {
    Copy-Item -LiteralPath $TargetFile -Destination $backupFile -Force
    Write-Host "バックアップを作成しました: $backupFile" -ForegroundColor Green
}

# スマートクォートの置換
$content = Get-Content -LiteralPath $TargetFile -Raw -Encoding UTF8
$fixedContent = $content -replace "Running scripts to modify the default user’s registry hive\.", "Running scripts to modify default user registry hive."
$fixedContent = $fixedContent -replace "[\u2018\u2019]", "'"
$fixedContent = $fixedContent -replace "[\u201C\u201D]", '"'

[System.IO.File]::WriteAllText($TargetFile, $fixedContent, [System.Text.Encoding]::UTF8)
Write-Host "修正を適用しました: $TargetFile" -ForegroundColor Green

# 構文チェックの実行
$errors = $null
$tokens = $null
[System.Management.Automation.Language.Parser]::ParseInput($fixedContent, [ref]$tokens, [ref]$errors) | Out-Null
if ($errors -and $errors.Count -gt 0) {
    Write-Error "構文エラーが依然として存在します:"
    $errors | ForEach-Object { Write-Error $_.Message }
} else {
    Write-Host "構文チェック合格: エラー 0" -ForegroundColor Green
}
