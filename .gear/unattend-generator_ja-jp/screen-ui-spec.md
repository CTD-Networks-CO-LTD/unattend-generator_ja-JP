# 画面UI定義書

```json
{
  "screens": [
    {
      "events": [
        {
          "action": "日本語キーボード設定判定",
          "trigger": "Keyboard 選択ボックス変更 (onChange)",
          "description": "値が '00000411' (日本語) に変更された場合、システム国際設定に kbd106.dll の適用と PCAT_106KEY のレジストリ書き換え処理、および言語配列の強制バインディングを自動スケジューリングする。"
        },
        {
          "action": "カスタム名入力欄の表示制御",
          "trigger": "ComputerNameMode 選択ボックス変更 (onChange)",
          "description": "選択値が 'Custom' の場合のみ 'ComputerName' テキストボックスを活性化、'Script' の場合はスクリプト入力フォームを表示する。"
        }
      ],
      "fields": [
        {
          "name": "LanguageMode",
          "type": "select",
          "required": true,
          "validation": "Unattended / Interactive のいずれかを選択",
          "description": "言語セットアップの無人化モード指定"
        },
        {
          "name": "Locale",
          "type": "select",
          "required": true,
          "validation": "システムロケールコード（例: ja-JP）",
          "description": "システムで使用する既定の地域・言語設定"
        },
        {
          "name": "Keyboard",
          "type": "select",
          "required": true,
          "validation": "キーボード識別子（例: 00000411 は日本語キーボード設定、00000409 はUSキーボード）",
          "description": "接続するキーボード配列の指定。ja-JP選択時は日本語キーボード配列の自動構成がトリガーされる。"
        },
        {
          "name": "ProcessorArchitecture",
          "type": "select",
          "required": true,
          "validation": "ProcessorArchitecture (amd64 / x86 / arm64)",
          "description": "Windowsインストール対象のプロセッサアーキテクチャ"
        },
        {
          "name": "ComputerNameMode",
          "type": "select",
          "required": true,
          "validation": "Random / Custom / Script",
          "description": "コンピューター名決定プロセス"
        },
        {
          "name": "ComputerName",
          "type": "text",
          "required": false,
          "validation": "半角英数字、15文字以内。特殊文字、全角スペース、数字のみは不可",
          "description": "CustomComputerNameSettings で使用される独自のコンピューター名"
        },
        {
          "name": "UserAccountMode",
          "type": "select",
          "required": true,
          "validation": "Unattended / Interactive",
          "description": "無人セットアップでの管理者・一般ユーザーアカウントの自動作成モード指定"
        },
        {
          "name": "AccountName0",
          "type": "text",
          "required": true,
          "validation": "一意の文字列。記号不可",
          "description": "作成する第1アカウントのユーザー名"
        },
        {
          "name": "AccountPassword0",
          "type": "password",
          "required": false,
          "validation": "最低制限なし。パスワード平文の難読化（ObscurePasswords）オプション連動あり",
          "description": "作成する第1アカウントのパスワード設定"
        },
        {
          "name": "PasswordExpirationMode",
          "type": "select",
          "required": true,
          "validation": "Unlimited / Custom",
          "description": "作成アカウントのパスワード有効期限切れポリシー"
        },
        {
          "name": "LockoutMode",
          "type": "select",
          "required": true,
          "validation": "Default / Disabled / Custom",
          "description": "連続パスワード入力失敗によるアカウントロックアウト設定ポリシー"
        },
        {
          "name": "PartitionLayout",
          "type": "select",
          "required": true,
          "validation": "PartitionLayout (GPT / MBR / Automatic)",
          "description": "インストール先ディスクに作成するパーティションレイアウト方式"
        },
        {
          "name": "RecoveryMode",
          "type": "select",
          "required": true,
          "validation": "RecoveryMode (Partition / None)",
          "description": "インストール時に回復パーティションを自動構成するか否か"
        },
        {
          "name": "ClassicContextMenu",
          "type": "checkbox",
          "required": false,
          "validation": "Boolean",
          "description": "Windows 11で従来のコンテキストメニューを有効化するレジストリ書き換え設定"
        },
        {
          "name": "DisableAppSuggestions",
          "type": "checkbox",
          "required": false,
          "validation": "Boolean",
          "description": "アプリの自動推薦、およびプリインストールされる不要なブロートウェア自動配信を抑制する設定"
        }
      ],
      "category": "設定入力",
      "overview": "Windows無人セットアップ（クリーンインストール）に必要な言語、キーボード、ユーザーアカウント、パーティションレイアウトなどのインストール詳細設定を行うためのメイン入力フォーム画面。日本語環境に特化した日本語キーボード設定や、クラシックコンテキストメニュー等の各種レジストリ書き換えオプションも指定可能。",
      "screenId": "SCR-001",
      "components": [
        {
          "name": "LanguageSection",
          "type": "form",
          "description": "言語設定および日本語キーボード設定、ロケール情報を管理・入力するセクション。"
        },
        {
          "name": "AccountSection",
          "type": "form",
          "description": "無人セットアップ時の作成ユーザーアカウント情報、管理者権限、およびパスワード有効期限、アカウントロックアウト設定を入力するセクション。"
        },
        {
          "name": "DiskSection",
          "type": "form",
          "description": "インストール対象ディスク、パーティションレイアウト、回復パーティション作成有無を指定するセクション。"
        },
        {
          "name": "OptimizationSection",
          "type": "form",
          "description": "ブロートウェア（プリインストールアプリ）の自動削除、クラシックコンテキストメニュー有効化等のシステム最適化フラグを選択するセクション。"
        },
        {
          "name": "ActionMenuBar",
          "type": "button-group",
          "description": "設定内容に基づき、自動応答ファイルを生成・プレビュー・ダウンロードするための各種アクションボタン群。"
        }
      ],
      "screenName": "インストール設定フォーム画面",
      "targetUser": "システム管理者 / インフラエンジニア",
      "transitions": [
        {
          "action": "応答ファイルの表示（View）ボタンクリック",
          "condition": "クライアントサイド生成によるプレビュー表示",
          "destination": "SCR-002"
        },
        {
          "action": "プリセット適用（Presets）ハイパーリンククリック",
          "condition": "なし",
          "destination": "SCR-003"
        }
      ],
      "operationSteps": [
        {
          "step": 1,
          "action": "「言語設定」から日本語（ja-JP）および日本語キーボード配列（00000411）を選択する。",
          "systemResponse": "日本語キーボード設定が認識され、自動的に LayeredDriver=1 などのレジストリ書き換え（kbd106.dll等）がバインドされる。"
        },
        {
          "step": 2,
          "action": "「アカウント設定」でユーザー名（AccountName0）とパスワードを設定し、パスワード有効期限とアカウントロックアウト設定を構成する。",
          "systemResponse": "ユーザーアカウント（Administrators/Usersグループ）情報が内部メモリ（GenerationContext.accounts）に蓄積される。"
        },
        {
          "step": 3,
          "action": "「ディスクパーティション構成」にてパーティションレイアウト（MBR/GPT/Automatic）を選択し、「最適化」セクションでブロートウェアの削除にチェックを入れる。",
          "systemResponse": "DiskModifier、BloatwareModifier 処理用の設定フラグがフォーム状態に保存される。"
        },
        {
          "step": 4,
          "action": "画面下部の「生成アクション」から目的の処理ボタン（プレビュー表示 / ダウンロード）を選択してクリックする。",
          "systemResponse": "「応答ファイルジェネレーター画面（SCR-002）」のハンドリングに遷移、あるいは直接各種ファイル生成ダウンロードが実行される。"
        }
      ],
      "sourceEvidence": [
        "unattend-generator_ja-JP/docs/js/modifiers/locales.js",
        "unattend-generator_ja-JP/docs/js/modifiers/users.js",
        "unattend-generator_ja-JP/docs/js/modifiers/disk.js",
        "unattend-generator_ja-JP/docs/js/modifiers/optimizations.js",
        "unattend-generator_ja-JP/docs/js/ui/form_bridge.js"
      ]
    },
    {
      "events": [
        {
          "action": "unattendEngine.handleEngineAction('download')",
          "trigger": "ダウンロード (Download) ボタンクリック (onClick)",
          "description": "クライアントのブラウザサイド、またはUNATTEND_CONFIG設定に応じたサーバーレスAPI（cloudflare-worker等）経由で、生成した autounattend.xml を即時配信ダウンロードする。"
        },
        {
          "action": "unattendEngine.handleEngineAction('iso')",
          "trigger": "ISOイメージ作成 (ISO) ボタンクリック (onClick)",
          "description": "createIsoBlob() 関数を実行し、仮想セクター（ISO 9660構造）を作成。自動応答ファイルを包含する「autounattend.iso」バイナリBlobとして、ブラウザから即時ダウンロードさせる。"
        },
        {
          "action": "unattendEngine.importXmlFile()",
          "trigger": "XMLファイルロード完了 (onLoad / FileReader)",
          "description": "インポートされたファイルを読み込み、extractQueryFromXml() を用いて、元となったジェネレーターのURLクエリにデコードした上で入力フォーム項目に復元する。"
        }
      ],
      "fields": [
        {
          "name": "XmlFileImport",
          "type": "file",
          "required": false,
          "validation": ".xml 拡張子、または valid な XML DOM 構造を持つファイル",
          "description": "読み込み用の autounattend.xml 設定ファイル"
        }
      ],
      "category": "ファイル生成",
      "overview": "入力された無人セットアップ定義情報に基づき、GenerationContext クラスを用いて autounattend.xml (自動応答ファイル) のクライアントサイド/サーバーサイド即時生成・表示を実行。また、物理インストールメディア組み込み用のISOイメージ（createIsoBlobによるautounattend.iso）の直接ダウンロードや、既存XML設定ファイルのインポート復元を提供する。",
      "screenId": "SCR-002",
      "components": [
        {
          "name": "OutputPreviewArea",
          "type": "tabs",
          "description": "生成された XML 応答ファイルのソースコードを表示・コピーできるシンタックスプレビューエリア。"
        },
        {
          "name": "GenerationActionGroup",
          "type": "button-group",
          "description": "自動応答ファイルのXML直接ダウンロード、およびISO 9660イメージ形式（autounattend.iso）でのダウンロードを選択実行するボタン群。"
        },
        {
          "name": "XmlImportBox",
          "type": "search-box",
          "description": "既存の autounattend.xml ファイルをドラッグ＆ドロップまたはファイル選択によりインポートし、以前の設定を瞬時にフォームへ復元するためのローダーコンポーネント。"
        }
      ],
      "screenName": "応答ファイルジェネレーター画面",
      "targetUser": "システム管理者 / インフラエンジニア",
      "transitions": [
        {
          "action": "既存設定のインポート・クエリ適用完了",
          "condition": "インポートファイルのクエリデータ抽出が成功した場合、フォーム画面に入力値が自動設定されてフォーカスが戻る",
          "destination": "SCR-001"
        }
      ],
      "operationSteps": [
        {
          "step": 1,
          "action": "生成コードプレビューを確認し、問題なければ「ダウンロード」または「ISOイメージダウンロード」ボタンをクリックする。",
          "systemResponse": "ブラウザのメモリ上で即時 Blob/IsoBlob が生成され、クライアント端末に対してファイル保存ダイアログが作動する。"
        },
        {
          "step": 2,
          "action": "既存の自動応答ファイルから同一設定を復元したい場合、インポートボックスから対象の XML ファイルを選択する。",
          "systemResponse": "importXmlFile 処理が走り、XMLのヘッダーコメント（URLクエリパラメータ）を抽出し、applyQueryToForm を介して入力フォーム（SCR-001）へ再バインドする。"
        }
      ],
      "sourceEvidence": [
        "unattend-generator_ja-JP/docs/js/ui/event_listener.js",
        "unattend-generator_ja-JP/docs/js/core/iso_builder.js",
        "unattend-generator_ja-JP/docs/js/generator_engine.js"
      ]
    },
    {
      "events": [
        {
          "action": "applyQueryToForm(presetQueryString)",
          "trigger": "プリセット適用ボタンクリック (onClick)",
          "description": "定義済みのプリセットパラメータを抽出し、入力フォーム全体の一括レジストリ書き換えフラグ、言語設定、アカウント情報として適用・同期する。"
        }
      ],
      "fields": [
        {
          "name": "SelectedPreset",
          "type": "radio",
          "required": true,
          "validation": "利用可能なプリセット定義値のいずれか",
          "description": "適用対象のプリセットテンプレート選択用ラジオボタン"
        }
      ],
      "category": "設定テンプレート",
      "overview": "あらかじめ構成された、特定ユースケースに最適化された無人セットアップのプリセット設定パターン（クリーンインストール最適化、開発者向け簡易設定、日本語環境標準テンプレート等）を選択し、メインフォームへ一括流し込み（適用）を行う画面。",
      "screenId": "SCR-003",
      "components": [
        {
          "name": "PresetSelectionCardGroup",
          "type": "card",
          "description": "プリセット（標準構成、ブロートウェア一括除去、管理者アカウント自動昇格構成など）の目的と特徴が記載された選択用カードレイアウト。"
        },
        {
          "name": "PresetActionForm",
          "type": "form",
          "description": "HTTP 405防止のために onsubmit='return false;' を制御したプリセット適用連携用フォーム。"
        }
      ],
      "screenName": "プリセット設定画面",
      "targetUser": "システム管理者 / デプロイメント担当者",
      "transitions": [
        {
          "action": "プリセット適用完了ボタン押下",
          "condition": "一括パラメータ適用の完了に伴い、メインの設定フォーム画面に遷移する（適用後の状態で編集可能となる）",
          "destination": "SCR-001"
        }
      ],
      "operationSteps": [
        {
          "step": 1,
          "action": "自身のデプロイ要件に最も近いプリセットカード（例:「日本語クリーンインストール標準」）を選択する。",
          "systemResponse": "対応するURLクエリ文字列パラメータが内部的に特定される。"
        },
        {
          "step": 2,
          "action": "「このプリセットを適用して編集」ボタンをクリックする。",
          "systemResponse": "formaction='./' に連動した applyQueryToForm メソッドによってクエリがパースされ、インストール設定フォーム画面（SCR-001）へ渡される。"
        }
      ],
      "sourceEvidence": [
        "unattend-generator_ja-JP/test_tools/verify_buttons.py",
        "unattend-generator_ja-JP/docs/js/ui/form_bridge.js"
      ]
    }
  ]
}
```