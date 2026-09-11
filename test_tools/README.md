# unattend-generator テストツール集

本ディレクトリには、ローカル環境でのブラウジング動作確認や、各ボタン・フォームの送信先検証、およびXML生成・ダウンロード・インポート機能のテストツール群が格納されています。

---

## 収録スクリプト一覧

| ファイル名 | 役割 |
| :--- | :--- |
| `interactive_test.ps1` | 統合自動検収・対話式テストランナー（メニュー選択式CLI） |
| `test_engine_parity.js` | モジュール分割エンジンとベースラインの完全一致検証（全9ケース Byte-exact 検証） |
| `test_feature_parity.js` | C# / JS 機能格差解消＆スマートクォート網羅自動テスト (Node.js) |
| `verify_ast_quotes.ps1` | PowerShell AST パーサーによるスクリプト構文解析＆スマートクォート検出ツール |
| `verify_vm_offline.ps1` | マウント済みVM仮想ディスク（オフライン）自動検収ツール |
| `apply_vm_fix.ps1` | マウント済みVM仮想ディスクの `DefaultUser.ps1` 修正適用スクリプト（管理者権限昇格対応） |
| `verify_node_engine.js` | Node.js 環境での `unattend_engine.js` 日本語キーボード・基本生成テスト |
| `verify_buttons.py` | 全ボタン・フォームの一括URL検証 & 個別ボタン動作シミュレーション |
| `test_e2e_engine.py` | クライアント側XML生成・ダウンロード・インポートエンジンの自動検証 |
| `xml_client_engine.js` | クライアントサイドXML生成・ISOバイナリ作成・インポートエンジン本体 |

---

## 使い方

### 1. 対話式テストツールの起動
PowerShellにて以下を実行します。

```powershell
powershell -ExecutionPolicy Bypass -File .\test_tools\interactive_test.ps1
```

起動後、以下のメニューが表示されます：
- `1`: ローカルテストサーバーを起動し、既定のブラウザで `http://localhost:8080/index.html` を開く
- `2`: 全ボタン・フォームの送信先URL（`action` / `formaction`）を一括自動検証
- `3`: 個別ボタン（Bookmark, Reset, Minimal, LocalUser, View, Download, ISO, Import）の動作確認
- `4`: XML生成・ダウンロードエンジンの検証テスト
- `5`: 機能格差解消＆スマートクォート網羅テスト (Node.js)
- `6`: PowerShell AST構文解析＆クォート検出 (AST Parser)
- `7`: VM仮想ディスク オフライン自動検収 (E:\)
- `8`: VM仮想ディスク DefaultUser.ps1 修正適用
- `9`: ローカルテストサーバーの停止
- `0`: ツール終了

---

### 2. 単体での実行

```bash
# 機能格差解消＆スマートクォート網羅テスト
node test_tools/test_feature_parity.js

# PowerShell AST 構文解析＆スマートクォート検出
powershell -ExecutionPolicy Bypass -File test_tools/verify_ast_quotes.ps1 -XmlPath tmp/test_generated_autounattend.xml

# マウント済みVM仮想ディスクの自動検収
powershell -ExecutionPolicy Bypass -File test_tools/verify_vm_offline.ps1 -MountDrive E:\
```



