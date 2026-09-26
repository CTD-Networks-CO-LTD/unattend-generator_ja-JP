# API仕様書

| endpoint | method | description | requestBody | responseBody | auth |
| --- | --- | --- | --- | --- | --- |
| N/A | N/A | 新規追加：12件、修正：0件、拡張：0件、削除：0件。既存のクライアントサイド処理（C#及びJSエンジン）をベースに、Web UIと協調動作し、かつCloudflare Workers等のサーバーサイド連携(BP-012)にも対応したRESTful API仕様を定義。 | [object Object] |  | [object Object] |
| /api/v1/auth/login | POST | サーバーサイドで保存した設定管理画面（履歴確認等）へアクセスするための認証トークンを発行します。 | [object Object] |  | [object Object] |
| /api/v1/auth/refresh | POST | 有効なリフレッシュトークンを用いて、新しいアクセストークンを再発行します。 | [object Object] |  | [object Object] |
| /api/v1/generator/contexts | GET | サーバーサイドに保存された自動応答ファイル設定（GenerationContext）の履歴を一覧取得します。アーキテクチャ、ロケール等のフィルタ条件、ページネーション、ソートに対応します。 |  |  | [object Object] |
| /api/v1/generator/contexts | POST | インストール設定フォームに入力された各種パラメータをサーバー側へ保存し、UUIDを払い出します。日本語設定、パーティション、削除対象ブロートウェア、レジストリUX設定、アカウント情報を含みます。 | [object Object] |  | [object Object] |
| /api/v1/generator/contexts/{id} | GET | 指定されたIDに対応する構成パラメータ情報を取得します。 |  |  | [object Object] |
| /api/v1/generator/contexts/{id} | PUT | 既存の構成情報を更新します。差分のみ、または全項目の差し替えを行います。 | [object Object] |  | [object Object] |
| /api/v1/generator/contexts/{id} | DELETE | 不要となったコンテキスト履歴をデータベースから物理削除します（カスケード削除により紐付くアカウント、スクリプトも一括削除されます）。 |  |  | [object Object] |
| /api/v1/generator/contexts/{id}/accounts | POST | 無人セットアップ時(BP-001)に自動作成されるWindowsローカルユーザーアカウント(Administrators/Users)情報をコンテキストに紐付けて定義します。 | [object Object] |  | [object Object] |
| /api/v1/generator/build | POST | 送信された入力パラメータ（GenerationContextと同構造）を解釈し、各Modifierパイプラインを実行して、完成した無人セットアップ応答ファイル（autounattend.xml）の生XMLテキストデータを即時に生成・返却します（BP-001/BP-012連携）。 | [object Object] |  | [object Object] |
| /api/v1/generator/download | POST | 構築された自動応答ファイル（autounattend.xml）を添付ファイルとしてダウンロードできるように、適切なContent-Dispositionヘッダーを付与したHTTPレスポンスを返却します（BP-012）。 | [object Object] |  | [object Object] |
| /api/v1/generator/iso | POST | JSエンジン内の `iso_builder.js` のアルゴリズムに準拠し、応答ファイル `autounattend.xml` を内包した簡易ブート用/格納用ISO 9660イメージのBlobデータを動的に作成・配信します。 | [object Object] |  | [object Object] |
| /api/v1/generator/stats | GET | 過去に生成された応答ファイル設定から、適用頻度の高いアーキテクチャ、言語設定、適用されたバイパス・ブロートウェア削除設定などの統計データを集計レポートとして取得します（バッチ・集計観点）。 |  |  | [object Object] |
| /api/summary | INFO | 追加: 9件 (アカウントCRUD、XML/ISO生成・解析、各種XMLバリデーター), 拡張: 3件 (生成コンテキスト管理APIへのセキュリティ・ネットワーク関連パラメータ拡張), 修正: 0件, 削除: 0件 |  |  | [object Object] |
| /api/generation-contexts | POST | 自動応答ファイル生成に必要なパラメータ群（プロセッサ、コンピュータ名、各種バイパス設定、セキュリティ設定等）を初期登録します。 | [object Object] |  | [object Object] |
| /api/generation-contexts/{id} | GET | 特定コンテキストの基本構成パラメータに加え、セキュリティポリシー設定（パスワード期限、アカウントロックアウト）を紐付けて取得します。BP-010のフォーム設定復元にも活用されます。 |  |  | [object Object] |
| /api/generation-contexts/{id} | PUT | 基本設定およびアカウントロックアウト、パスワード有効期限、セキュリティ維持設定（機密情報ファイル削除有無等）を更新します。 | [object Object] |  | [object Object] |
| /api/generation-contexts/{id}/accounts | GET | コンテキストに登録された無人セットアップ時自動作成用ローカルアカウントの一覧を取得します。 |  |  | [object Object] |
| /api/generation-contexts/{id}/accounts | POST | コンテキスト内に新規にローカルユーザーアカウントを作成登録します。同一アカウント名が存在する場合は重複エラーとなります（BP-006対応）。 | [object Object] |  | [object Object] |
| /api/generation-contexts/{id}/accounts/{accountId} | PUT | 登録されたローカルアカウントの設定項目（表示名、グループ、パスワード等）を変更します。 | [object Object] |  | [object Object] |
| /api/generation-contexts/{id}/accounts/{accountId} | DELETE | 無人セットアップアカウント定義から、指定したローカルアカウント情報を「物理削除」します。 |  |  | [object Object] |
| /api/generator/xml | POST | クライアント側またはサーバー側で構築されたコンテキスト情報から、先頭コメントにフォーム復元用設定クエリを書き込んだ正規「autounattend.xml」ファイルを生成します (BP-010対応)。 | [object Object] |  | [object Object] |
| /api/generator/iso | POST | 生成された autounattend.xml を元に、CD-ROMメディアとしてOSに認識可能なISO 9660ファイルイメージをバイト配列から動的にビルドし、ダウンロードリソースとして返却します (BP-007対応)。 | [object Object] |  | [object Object] |
| /api/generator/parse-xml | POST | インポートされた自動応答ファイル（XML）から先頭コメントブロックをスキャンし、埋め込まれている設定クエリ文字列をデコード・解析して、フォーム入力コントロールに割り当て可能なパラメータ構成オブジェクトを返却します (BP-010対応)。 | [object Object] |  | [object Object] |
| /api/validators/wifi-profile | POST | 登録・埋め込みが要請されたWi-Fiプロファイル記述用XMLが、Windows純正スキーマ定義(WLAN_profile_v1.xsd)に沿っているかを事前バリデーションします (BP-008対応)。 | [object Object] |  | [object Object] |
| /api/validators/applocker-policy | POST | アップロードされたセキュリティ規制記述用AppLockerPolicyXmlが、Windowsの AppLocker.xsd スキーマに合致しているかを精密検証します (BP-009対応)。 | [object Object] |  | [object Object] |
| SUMMARY | INFO | 追加: 5件, 修正: 0件, 拡張: 0件, 削除: 0件 |  |  | [object Object] |
| /api/generator/xml/view | POST | ポストされたフォームデータ（システム要件回避フラグ、簡易設定モード、ネットワークバイパス設定等）に基づき、Windowsセットアップ用の自動応答ファイル（autounattend.xml）をバックエンドで生成してテキスト(XML)として返却します。 | [object Object] |  | [object Object] |
| /api/generator/xml/download | POST | ポストされたフォームデータに基づき、autounattend.xmlファイルを生成し、Content-Dispositionヘッダーを付与してファイルダウンロードとして直接返却します。 | [object Object] |  | [object Object] |
| /api/generator/iso/download | POST | ポストされたフォームデータに基づき autounattend.xml を生成した上で、ISO 9660ファイル構造（ sectorサイズ2048Byte準拠）に適合する仮想フロッピー/CDメディアイメージ(.iso)をバイナリとして生成し、直接ダウンロード返却します。 | [object Object] |  | [object Object] |
| /api/generator/xml/view | GET | GETリクエストのURLクエリパラメータから設定情報を抽出し、サーバーサイドで自動応答ファイル(autounattend.xml)を生成してプレーンテキスト(XML形式)で応答します。外部連携やURL保存時からの直接呼び出しを目的とします。 |  |  | [object Object] |
| /api/generator/xml/download | GET | GETリクエストのURLクエリパラメータから設定情報を抽出し、サーバーサイドで自動応答ファイル(autounattend.xml)ファイルを動的生成し、直接ダウンロード可能なファイルとして返却します。 |  |  | [object Object] |