# 機能要件一覧

| id | functionName | description | relatedRequirement | priority |
| --- | --- | --- | --- | --- |
| FR-001 | 自動応答ファイル統合生成機能 | インストール設定フォーム画面および応答ファイルジェネレーター画面で入力されたパラメータ（GenerationContext）を解析し、無人セットアップで使用される自動応答ファイル（autounattend.xml）を一括生成する機能。各Modifierパイプラインを通じてXmlNodeツリー、Pass設定、およびPowerShellSequenceなどを統合してXMLファイルを構築する。 | REQ-001 | 高 |
| FR-002 | 日本語キーボード設定および日本語環境向けレジストリ書き換え機能 | クリーンインストール時および無人セットアップのwindowsPE、specialize、firstLogon、UserOnceなどのPassフェーズにおいて、日本語キーボード設定（kbd106.dll、PCAT_106KEY、キーボードサブタイプ2、タイプ7）を適用するためのレジストリ書き換え、および言語リスト（New-WinUserLanguageList）の永続化、システム設定コピー（Copy-UserInternationalSettingsToSystem）のPowerShellスクリプトを実行する機能。 | REQ-002 | 高 |
| FR-003 | クリーンインストール用パーティションレイアウトおよび回復パーティション設定機能 | インストールの際、パーティションレイアウト（PartitionLayout: MBR、GPT、Automatic等）に基づくディスク構成の自動定義、および回復パーティション（RecoveryMode）やシステムのサイズ設定、ターゲットディスクの自動選択を行うためのdiskpartスクリプトまたはWshシェルを自動生成して適用する機能。 | REQ-003 | 高 |
| FR-004 | ブロートウェア自動削除機能 | 無人セットアップ中に、不要な既定のプリインストールアプリケーション（OneDrive、Copilot、Cortana、BingSearch、Outlook等のブロートウェア）をPowerShellを用いて自動的に一括または個別で削除するためのスクリプト生成および埋め込み機能。 | REQ-004 | 中 |
| FR-005 | UI/UX最適化およびレジストリ書き換え機能 | クラシックコンテキストメニューの有効化、ファイル拡張子の常時表示、アプリ提案の無効化など、初期インストール後にデフォルトユーザープロファイルを含むレジストリ書き換え（reg.exeを用いたHKU\DefaultUserへの書き込み、およびPowerShellSequenceによる自動実行）を行い、UI/UXを最適化する機能。 | REQ-005 | 中 |
| FR-006 | ユーザーアカウント制御、パスワード有効期限、およびアカウントロックアウト設定機能 | 無人セットアップ時におけるローカル管理者およびユーザーアカウント（Administrators/Usersグループへの割当、自動ログオンカウント制限）の構成や、パスワード有効期限（UnlimitedPasswordExpirationSettings）、アカウントロックアウト設定（LockoutMode：ロックアウト閾値、ロックアウト期間、ロックアウトウィンドウ）を構成するコマンドラインを適用する機能。 | REQ-006 | 高 |
| FR-007 | クライアントサイド仮想 ISO イメージ生成・ダウンロード機能 | ブラウザ上で生成された自動応答ファイル（autounattend.xml）を、CD-ROMメディアとして認識可能なISO 9660ファイル（autounattend.iso）のBlob形式（createIsoBlob）に動的変換し、即時クライアントサイドのみでダウンロード保存可能にする機能。 | REQ-007 | 高 |
| FR-008 | Wi-Fi 接続プロファイル自動登録・有効化機能 | 無人セットアップ中にワイヤレスネットワークへの接続を自動構成するため、接続設定ファイル（Wifi.xml）を自動応答ファイルへ埋め込み、WlanSvcサービス稼働待機ループスクリプトを実行した上で、netsh.exeを通じて自動接続プロファイルを追加・適用する機能。 | REQ-008 | 中 |
| FR-009 | AppLocker ポリシー埋め込み・自動設定機能 | AppLockerModeが「Configure」の際、ユーザーがアップロードまたは貼り付けしたAppLockerPolicy.xmlを自動応答ファイル内に直接埋め込み、AppIDSvc（Application Identityサービス）を自動起動してポリシー適用コマンド（Set-AppLockerPolicy）を実行させる機能。 | REQ-009 | 中 |
| FR-010 | XML ファイルからの設定クエリ復元・自動フォーム入力機能 | 既存の自動応答ファイル（XML）内の先頭コメントから、シリアライズされて埋め込まれている設定クエリパラメータを抽出し、インストール設定フォーム画面（応答ファイルジェネレーター画面）の入力コントロール（ラジオボタン、テキスト、チェックボックス等）へ設定値を瞬時に復元・反映する機能。 | REQ-010 | 中 |
| FR-011 | システム要件チェック回避および簡易設定制御機能 | インストール時に発生するシステム要件（TPM、SecureBoot、RAM容量）のチェックを回避する設定（BypassRequirementsCheck）や、ネットワーク接続の確認をスキップする機能（BypassNetworkCheck/BypassNRO）、および初期インストール時のプライバシー簡易設定（ExpressSettings）を自動的に無効化・制御（ProtectYourPC）する機能。 | REQ-011 | 高 |
| FR-012 | サーバーサイド API を介した自動応答ファイル生成機能 | Cloudflare WorkersなどのサーバーサイドAPIエンドポイント経由（POST/GETリクエスト）でフォームデータパラメータを受け取り、同様の生成ロジックにより自動応答ファイル（XML）の表示、ダウンロード、およびISOイメージダウンロード用レスポンスを生成・中継する機能。 | REQ-012 | 低 |