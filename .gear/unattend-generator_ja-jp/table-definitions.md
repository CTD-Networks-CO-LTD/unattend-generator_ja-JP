# テーブル定義

| tableName | columnName | dataType | nullable | primaryKey | description |
| --- | --- | --- | --- | --- | --- |
| generation_contexts | id | UUID | NO | YES | 自動応答ファイル生成コンテキストのユニーク識別子 |
| generation_contexts | mode | VARCHAR(20) | NO | NO | 応答ファイルジェネレーター画面の動作モード (client または server) |
| generation_contexts | processor_architecture | VARCHAR(10) | NO | NO | プロセッサアーキテクチャ (ProcessorArchitecture: x86, amd64, arm64) |
| generation_contexts | computer_name_mode | VARCHAR(20) | NO | NO | コンピューター名設定モード (Random, Custom, Script) |
| generation_contexts | computer_name | VARCHAR(15) | YES | NO | 無人セットアップに設定するカスタムコンピューター名 |
| generation_contexts | language_mode | VARCHAR(20) | NO | NO | 言語設定モード (Unattended, Interactive) |
| generation_contexts | ui_language | VARCHAR(10) | NO | NO | 無人セットアップのUI言語定義 (例: ja-JP) |
| generation_contexts | locale | VARCHAR(10) | NO | NO | システム規定のロケール設定 |
| generation_contexts | keyboard | VARCHAR(20) | NO | NO | 日本語キーボード設定を含むキーボード識別番号 |
| generation_contexts | geo_location | VARCHAR(10) | NO | NO | 地理的位置情報 (GeoLocation ID) |
| generation_contexts | time_zone_mode | VARCHAR(20) | NO | NO | タイムゾーン設定モード (Implicit, Explicit) |
| generation_contexts | time_zone | VARCHAR(50) | YES | NO | 設定されるタイムゾーンID (例: Tokyo Standard Time) |
| generation_contexts | user_account_mode | VARCHAR(20) | NO | NO | ユーザーアカウント作成モード (Unattended, Interactive) |
| generation_contexts | auto_logon_mode | VARCHAR(20) | NO | NO | 簡易設定（自動ログオン設定モード） |
| generation_contexts | obscure_passwords | BOOLEAN | NO | NO | 応答ファイル内パスワード難読化有効化フラグ |
| generation_contexts | keep_sensitive_files | BOOLEAN | NO | NO | セットアップ完了後に機密情報ファイルを維持するフラグ |
| generation_contexts | bypass_requirements_check | BOOLEAN | NO | NO | クリーンインストール要件（TPM/RAM等）をレジストリ書き換えでバイパスするフラグ |
| generation_contexts | bypass_network_check | BOOLEAN | NO | NO | OOBE中のネットワーク接続要件をレジストリ書き換えでバイパスするフラグ |
| generation_contexts | express_settings_mode | VARCHAR(20) | NO | NO | Windows初期簡易設定モード (ExpressSettingsMode: Interactive, EnableAll, DisableAll) |
| generation_contexts | classic_context_menu | BOOLEAN | NO | NO | Windows11でクラシックコンテキストメニューを有効化するレジストリ書き換えフラグ |
| generation_contexts | show_file_extensions | BOOLEAN | NO | NO | エクスプローラーでファイル拡張子を常に表示する設定フラグ |
| generation_contexts | disable_app_suggestions | BOOLEAN | NO | NO | ブロートウェアや余計なアプリ提案をレジストリ書き換えで無効化するフラグ |
| generation_contexts | commit_hash | VARCHAR(40) | NO | NO | ジェネレーターが使用したソースコードのGitコミットハッシュ |
| accounts | id | UUID | NO | YES | アカウント設定の一意な識別子 |
| accounts | generation_context_id | UUID | NO | NO | 親となる自動応答ファイル生成コンテキストの外部キー |
| accounts | name | VARCHAR(100) | NO | NO | 作成するローカルユーザーアカウント名 |
| accounts | display_name | VARCHAR(255) | YES | NO | ユーザーアカウントの表示名 |
| accounts | user_group | VARCHAR(50) | NO | NO | 所属グループ (Administrators / Users) |
| accounts | password | VARCHAR(255) | YES | NO | ログイン用パスワード (プレーンテキストまたは難読化文字列) |
| scripts | id | UUID | NO | YES | カスタムスクリプトの一意な識別子 |
| scripts | generation_context_id | UUID | NO | NO | 親となる自動応答ファイル生成コンテキストの外部キー |
| scripts | phase | VARCHAR(30) | NO | NO | 無人セットアップ中の実行対象フェーズ (ScriptPhase: System, FirstLogon, UserOnce, DefaultUser) |
| scripts | script_type | VARCHAR(10) | NO | NO | スクリプトファイルの形式 (ScriptType: Cmd, Ps1, Reg, Vbs, Js) |
| scripts | content | TEXT | NO | NO | 実行するスクリプトまたはレジストリ書き換えのコード本文 |
| components_and_passes | id | UUID | NO | YES | カスタムXMLコンポーネント設定の一意な識別子 |
| components_and_passes | generation_context_id | UUID | NO | NO | 親となる自動応答ファイル生成コンテキストの外部キー |
| components_and_passes | component_name | VARCHAR(255) | NO | NO | 注入ターゲットのWindowsコンポーネント識別子 |
| components_and_passes | pass_name | VARCHAR(30) | NO | NO | Windows無人セットアップの構成パス (Pass: offlineServicing, windowsPE, generalize, specialize, auditSystem, auditUser, oobeSystem) |
| components_and_passes | content | TEXT | NO | NO | 挿入されるカスタムXMLマークアップ構造 |
| wifi_profiles | id | UUID | NO | YES | Wi-Fi接続プロファイルの一意な識別子 |
| wifi_profiles | generation_context_id | UUID | NO | NO | 親となる自動応答ファイル生成コンテキストの外部キー |
| wifi_profiles | wifi_mode | VARCHAR(20) | NO | NO | Wi-Fi適用モード (Interactive, FromProfile) |
| wifi_profiles | profile_xml | TEXT | YES | NO | 適用するWLANプロファイルの生XMLテキスト |
| applocker_policies | id | UUID | NO | YES | AppLockerセキュリティ制限ポリシーの一意な識別子 |
| applocker_policies | generation_context_id | UUID | NO | NO | 親となる自動応答ファイル生成コンテキストの外部キー |
| applocker_policies | applocker_mode | VARCHAR(20) | NO | NO | AppLockerポリシー設定モード (Skip, Configure) |
| applocker_policies | policy_xml | TEXT | YES | NO | Windowsに強制するAppLocker XMLポリシー構成 |
| lockout_settings | id | UUID | NO | YES | アカウントロックアウト設定の一意な識別子 |
| lockout_settings | generation_context_id | UUID | NO | NO | 親となる自動応答ファイル生成コンテキストの外部キー |
| lockout_settings | lockout_mode | VARCHAR(20) | NO | NO | アカウントロックアウト設定のポリシー (Default, Disabled, Custom) |
| lockout_settings | lockout_threshold | INTEGER | YES | NO | ロックアウト閾値（無効ログインを何回許容するか） |
| lockout_settings | lockout_duration | INTEGER | YES | NO | ロックアウト維持時間（分） |
| lockout_settings | lockout_window | INTEGER | YES | NO | 失敗カウンターのリセット時間ウィンドウ（分） |
| password_expiration_settings | id | UUID | NO | YES | パスワード有効期限ポリシー設定の一意な識別子 |
| password_expiration_settings | generation_context_id | UUID | NO | NO | 親となる自動応答ファイル生成コンテキストの外部キー |
| password_expiration_settings | password_expiration_mode | VARCHAR(20) | NO | NO | 有効期限ポリシーモード (Default, Unlimited, Custom) |
| password_expiration_settings | max_password_age | INTEGER | YES | NO | パスワードの最大有効期限（日数） |