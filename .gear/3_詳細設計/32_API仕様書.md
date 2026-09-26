# API仕様書

本ドキュメントは、Windows 無人セットアップ応答ファイル生成システム（`unattend-generator_ja-JP`）における RESTful API およびサーバーレス API（Cloudflare Workers 連携含む）の仕様を定義したものです。

---

## 1. API 概要と共通仕様

### 1.1 基本情報
- **ベースURL**: `/api/v1` または `/api`
- **データ形式**: リクエスト：`application/json` または `multipart/form-data`、レスポンス：`application/json`、`application/xml`、`application/x-iso9660-image`
- **文字コード**: UTF-8

### 1.2 共通エラーレスポンス構造
エラー発生時は以下の統一 JSON フォーマットで返却されます：
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ComputerName contains invalid characters.",
    "details": [
      {
        "field": "computer_name",
        "issue": "Invalid character in computer name"
      }
    ]
  }
}
```

---

## 2. 認証・認可 API

### 2.1 ログイン (POST `/api/v1/auth/login`)
管理画面（コンテキスト履歴確認等）へアクセスするための JWT トークンを発行します。

- **認証**: なし
- **リクエストボディ (`application/json`)**:
  ```json
  {
    "username": "admin",
    "password": "Password123!"
  }
  ```
- **レスポンスボディ (200 OK)**:
  ```json
  {
    "token_type": "Bearer",
    "access_token": "eyJhbGciOi...",
    "expires_in": 3600,
    "refresh_token": "d8e3f..."
  }
  ```
- **エラーレスポンス**: `401 Unauthorized`（資格情報無効）

### 2.2 トークンリフレッシュ (POST `/api/v1/auth/refresh`)
有効なリフレッシュトークンを用いて、新しいアクセストークンを再発行します。

- **認証**: なし
- **リクエストボディ (`application/json`)**:
  ```json
  {
    "refresh_token": "d8e3f..."
  }
  ```
- **レスポンスボディ (200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "expires_in": 3600
  }
  ```

---

## 3. 生成コンテキスト管理 API

### 3.1 コンテキスト一覧取得 (GET `/api/v1/generator/contexts`)
保存された自動応答ファイル設定の履歴を一覧取得します。

- **認証**: `Bearer <token>`
- **クエリパラメータ**:
  - `arch` (string, optional): アーキテクチャ (`amd64`, `x86`, `arm64`)
  - `locale` (string, optional): ロケールコード (`ja-JP` 等)
  - `limit` (integer, default: 20): 取得件数
  - `offset` (integer, default: 0): ページネーション開始位置
- **レスポンスボディ (200 OK)**:
  ```json
  {
    "total": 1,
    "items": [
      {
        "id": "c1f8a84e-37c2-48e0-bb15-5e6382098d01",
        "processor_architecture": "amd64",
        "locale": "ja-JP",
        "keyboard": "00000411",
        "created_at": "2026-09-27T04:00:00Z"
      }
    ]
  }
  ```

### 3.2 コンテキスト新規保存 (POST `/api/v1/generator/contexts`)
フォーム入力パラメータをサーバーに保存し、UUID を発行します。

- **認証**: `Bearer <token>`
- **リクエストボディ (`application/json`)**:
  ```json
  {
    "mode": "client",
    "processor_architecture": "amd64",
    "computer_name_mode": "Custom",
    "computer_name": "WIN11-DEV",
    "language_mode": "Unattended",
    "ui_language": "ja-JP",
    "locale": "ja-JP",
    "keyboard": "00000411",
    "time_zone": "Tokyo Standard Time",
    "bypass_requirements_check": true,
    "classic_context_menu": true
  }
  ```
- **レスポンスボディ (201 Created)**:
  ```json
  {
    "id": "c1f8a84e-37c2-48e0-bb15-5e6382098d01",
    "status": "created"
  }
  ```

### 3.3 コンテキスト詳細取得 (GET `/api/v1/generator/contexts/{id}`)
指定 ID の構成パラメータおよび紐付くアカウント・スクリプトを取得します。

- **認証**: `Bearer <token>`
- **レスポンスボディ (200 OK)**:
  ```json
  {
    "id": "c1f8a84e-37c2-48e0-bb15-5e6382098d01",
    "processor_architecture": "amd64",
    "locale": "ja-JP",
    "keyboard": "00000411",
    "accounts": [
      {
        "id": "f5a2b...",
        "name": "AdminUser",
        "user_group": "Administrators"
      }
    ]
  }
  ```

### 3.4 コンテキスト削除 (DELETE `/api/v1/generator/contexts/{id}`)
指定したコンテキストおよび関連データをカスケード物理削除します。

- **認証**: `Bearer <token>`
- **レスポンスボディ (204 No Content)**: なし

---

## 4. 応答ファイル・ISO 生成 API (ジェネレーター)

### 4.1 応答ファイルプレビュー生成 (POST `/api/generator/xml/view` または `/api/v1/generator/build`)
送信された入力パラメータ（`FormData` または JSON）から `autounattend.xml` の生 XML テキストを即時に生成・返却します。

- **認証**: なし
- **リクエストボディ (`multipart/form-data` または `application/json`)**:
  - `LanguageMode`: `Unattended`
  - `Locale`: `ja-JP`
  - `Keyboard`: `00000411`
  - `ProcessorArchitecture`: `amd64`
  - `ComputerName`: `WIN11-PC`
  - `AccountName0`: `AdminUser`
  - `AccountPassword0`: `P@ssw0rd!`
- **レスポンスボディ (200 OK)**:
  - **Content-Type**: `text/xml; charset=utf-8`
  - **Body**: 生成された `autounattend.xml` の XML テキスト（UTF-8）
- **エラーレスポンス (400 Bad Request)**:
  ```json
  {
    "error": "Validation failed: ComputerName exceeds 15 characters limit."
  }
  ```

### 4.2 応答ファイルダウンロード (POST `/api/generator/xml/download`)
送信されたパラメータから `autounattend.xml` を生成し、ブラウザのダウンロードダイアログを起動させるヘッダー付きで返却します。

- **認証**: なし
- **レスポンスボディ (200 OK)**:
  - **Content-Type**: `application/xml; charset=utf-8`
  - **Content-Disposition**: `attachment; filename="autounattend.xml"`
  - **Body**: `autounattend.xml` の生バイナリ/テキスト

### 4.3 ISO 9660 イメージダウンロード (POST `/api/generator/iso/download` または `/api/v1/generator/iso`)
生成された `autounattend.xml` を内包した、2048Byte セクター構造に適合する仮想ブート/CD メディアイメージ（`.iso`）を動的に生成し返却します。

- **認証**: なし
- **レスポンスボディ (200 OK)**:
  - **Content-Type**: `application/x-iso9660-image`
  - **Content-Disposition**: `attachment; filename="autounattend.iso"`
  - **Body**: ISO 9660 規格に準拠したバイナリデータストリーム

### 4.4 XML ファイル解析・パラメータ復元 (POST `/api/generator/parse-xml`)
インポートされた `autounattend.xml` の先頭コメントブロックをスキャンし、埋め込まれている設定クエリ文字列をデコードしてフォーム入力パラメータ構成を返却します。

- **認証**: なし
- **リクエストボディ (`multipart/form-data`)**:
  - `file`: アップロードする XML ファイル（`autounattend.xml`）
- **レスポンスボディ (200 OK)**:
  ```json
  {
    "success": true,
    "params": {
      "LanguageMode": "Unattended",
      "Locale": "ja-JP",
      "Keyboard": "00000411",
      "ProcessorArchitecture": "amd64",
      "ComputerName": "WIN11-PC"
    }
  }
  ```

---

## 5. バリデーション API

### 5.1 Wi-Fi プロファイル検証 (POST `/api/validators/wifi-profile`)
登録・埋め込みが要請された Wi-Fi プロファイル用 XML が、Windows 純正スキーマ（`WLAN_profile_v1.xsd`）に準拠しているかを事前検証します。

- **認証**: なし
- **リクエストボディ (`application/json`)**:
  ```json
  {
    "profile_xml": "<?xml version=\"1.0\"?>\n<WLANProfile xmlns=\"http://www.microsoft.com/networking/WLAN/profile/v1\">...</WLANProfile>"
  }
  ```
- **レスポンスボディ (200 OK)**:
  ```json
  {
    "valid": true,
    "ssid": "Office-Guest-WiFi",
    "auth": "WPA2PSK"
  }
  ```
- **エラーレスポンス (400 Bad Request)**: スキーマ違反詳細を含む JSON エラー

### 5.2 AppLocker ポリシー検証 (POST `/api/validators/applocker-policy`)
アップロードされた AppLockerPolicyXml が、Windows の `AppLocker.xsd` スキーマに合致しているかを精密検証します。

- **認証**: なし
- **リクエストボディ (`application/json`)**:
  ```json
  {
    "policy_xml": "<AppLockerPolicy Version=\"1\"><RuleCollection Type=\"Exe\">...</RuleCollection></AppLockerPolicy>"
  }
  ```
- **レスポンスボディ (200 OK)**:
  ```json
  {
    "valid": true,
    "rule_count": 5
  }
  ```

---

## 6. 統計・集計 API

### 6.1 生成統計レポート取得 (GET `/api/v1/generator/stats`)
過去に生成された応答ファイル設定から、適用頻度の高いアーキテクチャ、言語、バイパス設定等の統計データを集計レポートとして取得します。

- **認証**: `Bearer <token>`（権限: `report:read`）
- **レスポンスボディ (200 OK)**:
  ```json
  {
    "total_generated": 1420,
    "top_architectures": {
      "amd64": 1280,
      "arm64": 120,
      "x86": 20
    },
    "japanese_keyboard_ratio": 0.85,
    "tpm_bypass_ratio": 0.92
  }
  ```
