# unattend-generator 対話式テストツール
$port = 8080
$toolsDir = $PSScriptRoot
$docsPath = Join-Path $PSScriptRoot "..\docs"
$verifyScript = Join-Path $toolsDir "verify_buttons.py"

function Check-Server-Status {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*http.server $port*" }
    return ($null -ne $processes)
}

function Start-Test-Server {
    if (Check-Server-Status) {
        Write-Host "ローカルサーバー (ポート: $port) は既に起動しています。" -ForegroundColor Yellow
    } else {
        Write-Host "ローカルサーバーを起動しています..." -ForegroundColor Cyan
        Start-Process python -ArgumentList "-m", "http.server", "$port", "-d", "$docsPath" -WindowStyle Hidden
        Start-Sleep -Seconds 1
        Write-Host "サーバー起動完了: http://localhost:$port/index.html" -ForegroundColor Green
    }
    Write-Host "ブラウザを開きます..." -ForegroundColor Cyan
    Start-Process "http://localhost:$port/index.html"
}

function Stop-Test-Server {
    Write-Host "ローカルサーバーを停止しています..." -ForegroundColor Cyan
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*http.server $port*" }
    if ($processes) {
        foreach ($proc in $processes) {
            Stop-Process -Id $proc.ProcessId -Force
            Write-Host "PID $($proc.ProcessId) を停止しました。" -ForegroundColor Green
        }
    } else {
        Write-Host "起動中のサーバーはありません。" -ForegroundColor Gray
    }
}

function Run-Button-Verification {
    Write-Host "`n全ボタン・フォームの送信先URL検証を実行中..." -ForegroundColor Cyan
    python $verifyScript verify
}

function Run-Individual-Button-Test {
    while ($true) {
        Write-Host "`n=== 個別ボタン動作確認メニュー ===" -ForegroundColor Cyan
        Write-Host "  1. Bookmark selection (ブックマークの選択)"
        Write-Host "  2. Reset form to default values (デフォルト値にリセット)"
        Write-Host "  3. Configure for minimal output (最小限の出力に設定)"
        Write-Host "  4. Just create one local user account (ローカルユーザー1件作成)"
        Write-Host "  5. Import file (ファイルインポート)"
        Write-Host "  6. View .xml file (.xmlファイル表示)"
        Write-Host "  7. Download .xml file (.xmlダウンロード)"
        Write-Host "  8. Download .xml wrapped in .iso file (.isoダウンロード)"
        Write-Host "  b. 戻る"
        
        $btnChoice = Read-Host "確認したいボタンの番号を選択してください"
        switch ($btnChoice) {
            "1" { python $verifyScript sim:bookmark }
            "2" { python $verifyScript sim:reset }
            "3" { python $verifyScript sim:minimal }
            "4" { python $verifyScript sim:localuser }
            "5" { python $verifyScript sim:import }
            "6" { python $verifyScript sim:view }
            "7" { python $verifyScript sim:download }
            "8" { python $verifyScript sim:iso }
            "b" { return }
            "B" { return }
            default { Write-Host "無効な選択です。" -ForegroundColor Red }
        }
    }
}

function Run-E2E-Engine-Test {
    Write-Host "`nXML生成・ダウンロード・インポートエンジンのテストを実行中..." -ForegroundColor Cyan
    python (Join-Path $toolsDir "test_e2e_engine.py")
}

function Run-Feature-Parity-Test {
    Write-Host "`n機能格差解消＆スマートクォート網羅テストを実行中..." -ForegroundColor Cyan
    node (Join-Path $toolsDir "test_feature_parity.js")
}

function Run-Ast-Quote-Verification {
    Write-Host "`nPowerShell AST 構文解析＆スマートクォート検出を実行中..." -ForegroundColor Cyan
    $testXml = Join-Path $toolsDir "..\..\tmp\test_generated_autounattend.xml"
    if (Test-Path $testXml) {
        powershell -ExecutionPolicy Bypass -File (Join-Path $toolsDir "verify_ast_quotes.ps1") -XmlPath $testXml
    } else {
        powershell -ExecutionPolicy Bypass -File (Join-Path $toolsDir "verify_ast_quotes.ps1") -ScriptDir "E:\Windows\Setup\Scripts"
    }
}

function Run-Vm-Offline-Verification {
    Write-Host "`nマウント済みVMディスク（オフライン）自動検収を実行中..." -ForegroundColor Cyan
    powershell -ExecutionPolicy Bypass -File (Join-Path $toolsDir "verify_vm_offline.ps1") -MountDrive "E:\"
}

function Run-Apply-Vm-Fix {
    Write-Host "`nマウント済みVMディスクの DefaultUser.ps1 修正を適用..." -ForegroundColor Cyan
    powershell -ExecutionPolicy Bypass -File (Join-Path $toolsDir "apply_vm_fix.ps1") -TargetFile "E:\Windows\Setup\Scripts\DefaultUser.ps1"
}

# メインループ
while ($true) {
    $serverRunning = Check-Server-Status
    $serverStatusText = if ($serverRunning) { "[起動中 (http://localhost:$port/)]" } else { "[停止中]" }
    $serverStatusColor = if ($serverRunning) { "Green" } else { "DarkGray" }

    Write-Host "`n========================================================" -ForegroundColor Magenta
    Write-Host "  unattend-generator 統合自動検収・対話型テストツール" -ForegroundColor White
    Write-Host "  サーバー稼働状況: $serverStatusText" -ForegroundColor $serverStatusColor
    Write-Host "========================================================" -ForegroundColor Magenta
    Write-Host " 1. ローカルテストサーバー起動 & ブラウザで開く"
    Write-Host " 2. 全ボタン・フォームの一括URL検証テスト"
    Write-Host " 3. 個別ボタンの動作・パラメータ確認"
    Write-Host " 4. XML生成・ダウンロードエンジンの検証テスト"
    Write-Host " 5. 機能格差解消＆スマートクォート網羅テスト (Node.js)"
    Write-Host " 6. PowerShell AST構文解析＆クォート検出 (AST Parser)"
    Write-Host " 7. VM仮想ディスク オフライン自動検収 (E:\)"
    Write-Host " 8. VM仮想ディスク DefaultUser.ps1 修正適用"
    Write-Host " 9. ローカルテストサーバー停止"
    Write-Host " 0. 終了"
    Write-Host "--------------------------------------------------------"

    $choice = Read-Host "メニュー番号を選択してください"
    switch ($choice) {
        "1" { Start-Test-Server }
        "2" { Run-Button-Verification }
        "3" { Run-Individual-Button-Test }
        "4" { Run-E2E-Engine-Test }
        "5" { Run-Feature-Parity-Test }
        "6" { Run-Ast-Quote-Verification }
        "7" { Run-Vm-Offline-Verification }
        "8" { Run-Apply-Vm-Fix }
        "9" { Stop-Test-Server }
        "0" { 
            Write-Host "テストツールを終了します。" -ForegroundColor Cyan
            exit 0 
        }
        default {
            Write-Host "有効な番号を入力してください。" -ForegroundColor Red
        }
    }
}
