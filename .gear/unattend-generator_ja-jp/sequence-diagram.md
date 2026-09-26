# シーケンス図

## 応答ファイル生成

インストール設定フォームに入力された各種パラメータを解析し、無人セットアップで使用される自動応答ファイル（autounattend.xml）を一括構築して返却する。

**参加者:** ユーザー (actor)、応答ファイルジェネレーター画面 (system)、index.js (EventListener) (system)、generator_engine.js (system)、GenerationContext (system)、各Modifierクラス (ComputerName, Users等) (system)、PowerShellSequence (system)、XmlNode (system)

**メッセージフロー:**
- ユーザー → 応答ファイルジェネレーター画面: 生成/ダウンロードボタンクリック
- 応答ファイルジェネレーター画面 → index.js (EventListener): handleEngineAction('download', form)
- index.js (EventListener) → generator_engine.js: generateAutounattendXml(formData)
- generator_engine.js → GenerationContext: new GenerationContext(formData)
- GenerationContext → XmlNode: new XmlNode('unattend', attrs)
- GenerationContext → GenerationContext: Windowsセットアップ各Pass（windowsPE, specialize等）のノードを初期化
  - GenerationContext ← generator_engine.js: インスタンス返却
- generator_engine.js → 各Modifierクラス (ComputerName, Users等): process() ループ実行 (各Modifierのパイプライン処理)
- 各Modifierクラス (ComputerName, Users等) → GenerationContext: getVal() / getBool() を介してフォーム値を取得
  - GenerationContext ← 各Modifierクラス (ComputerName, Users等): 設定パラメータ値
- 各Modifierクラス (ComputerName, Users等) → GenerationContext: embedTextFile() / xml.addChild() 設定追加
- 各Modifierクラス (ComputerName, Users等) → 各Modifierクラス (ComputerName, Users等): プロセッサアーキテクチャなどの入力値バリデーション
  - 各Modifierクラス (ComputerName, Users等) ← generator_engine.js: 処理完了
- generator_engine.js → PowerShellSequence: finalizePowerShellSequences(context) 実行
- PowerShellSequence → PowerShellSequence: getScript() で各フェーズの埋め込みスクリプト文字列を最終化
  - PowerShellSequence ← generator_engine.js: スクリプト文字列返却
- generator_engine.js → XmlNode: serialize(0) 呼び出し (XML文字エンティティ化・エスケープ適用)
  - XmlNode ← generator_engine.js: シリアライズされた XML テキストデータ
  - generator_engine.js ← index.js (EventListener): autounattend.xml テキスト返却
- index.js (EventListener) → 応答ファイルジェネレーター画面: BlobURL経由でダウンロードリンク生成/ダウンロード開始
  - 応答ファイルジェネレーター画面 ← ユーザー: ファイルの保存ダイアログ表示 / 保存完了

```mermaid
sequenceDiagram
    actor user as ユーザー
    participant ui as 応答ファイルジェネレーター画面
    participant index as index.js (EventListener)
    participant engine as generator_engine.js
    participant context as GenerationContext
    participant modifier as 各Modifierクラス (ComputerName, Users等)
    participant sequence as PowerShellSequence
    participant xmlnode as XmlNode
    user->>ui: 生成/ダウンロードボタンクリック
    ui->>index: handleEngineAction('download', form)
    index->>engine: generateAutounattendXml(formData)
    engine->>context: new GenerationContext(formData)
    context->>xmlnode: new XmlNode('unattend', attrs)
    context->>context: Windowsセットアップ各Pass（windowsPE, specialize等）のノードを初期化
    context-->>engine: インスタンス返却
    engine->>modifier: process() ループ実行 (各Modifierのパイプライン処理)
    modifier->>context: getVal() / getBool() を介してフォーム値を取得
    context-->>modifier: 設定パラメータ値
    modifier->>context: embedTextFile() / xml.addChild() 設定追加
    modifier->>modifier: プロセッサアーキテクチャなどの入力値バリデーション
    modifier-->>engine: 処理完了
    engine->>sequence: finalizePowerShellSequences(context) 実行
    sequence->>sequence: getScript() で各フェーズの埋め込みスクリプト文字列を最終化
    sequence-->>engine: スクリプト文字列返却
    engine->>xmlnode: serialize(0) 呼び出し (XML文字エンティティ化・エスケープ適用)
    xmlnode-->>engine: シリアライズされた XML テキストデータ
    engine-->>index: autounattend.xml テキスト返却
    index->>ui: BlobURL経由でダウンロードリンク生成/ダウンロード開始
    ui-->>user: ファイルの保存ダイアログ表示 / 保存完了
```

## 日本語環境設定

無人セットアップ時の言語およびキーボード設定において、日本語(ja-JP)および日本語キーボード用の特化設定と、文字化けやレジストリ不整合を防ぐ自動コマンドを生成する。

**参加者:** generator_engine.js (system)、LocalesModifier (system)、GenerationContext (system)、XmlNode (windowsPE) (system)、PowerShellSequence (specialize) (system)、PowerShellSequence (firstLogon) (system)

**メッセージフロー:**
- generator_engine.js → LocalesModifier: process() 呼び出し
- LocalesModifier → GenerationContext: getVal('Keyboard'), getVal('Locale') 取得
  - GenerationContext ← LocalesModifier: Keyboard='00000411', Locale='ja-JP' 返却
- LocalesModifier → LocalesModifier: isJapaneseKeyboard 判定を true にセット
- LocalesModifier → GenerationContext: windowsPE 設定パスの XML コンポーネントを取得
- GenerationContext → XmlNode (windowsPE): Microsoft-Windows-International-Core-WinPE 配下に <LayeredDriver>1</LayeredDriver> 注入
- LocalesModifier → PowerShellSequence (specialize): append(レジストリ書き換えコマンド群: kbd106.dll, PCAT_106KEY 適用等)
- LocalesModifier → PowerShellSequence (firstLogon): append(New-WinUserLanguageList -Language 'ja-JP' / Copy-UserInternationalSettingsToSystem 適用)
  - LocalesModifier ← generator_engine.js: 処理完了

```mermaid
sequenceDiagram
    participant engine as generator_engine.js
    participant locales_mod as LocalesModifier
    participant context as GenerationContext
    participant xmlnode as XmlNode (windowsPE)
    participant specialize_seq as PowerShellSequence (specialize)
    participant firstlogon_seq as PowerShellSequence (firstLogon)
    engine->>locales_mod: process() 呼び出し
    locales_mod->>context: getVal('Keyboard'), getVal('Locale') 取得
    context-->>locales_mod: Keyboard='00000411', Locale='ja-JP' 返却
    locales_mod->>locales_mod: isJapaneseKeyboard 判定を true にセット
    locales_mod->>context: windowsPE 設定パスの XML コンポーネントを取得
    context->>xmlnode: Microsoft-Windows-International-Core-WinPE 配下に <LayeredDriver>1</LayeredDriver> 注入
    locales_mod->>specialize_seq: append(レジストリ書き換えコマンド群: kbd106.dll, PCAT_106KEY 適用等)
    locales_mod->>firstlogon_seq: append(New-WinUserLanguageList -Language 'ja-JP' / Copy-UserInternationalSettingsToSystem 適用)
    locales_mod-->>engine: 処理完了
```

## ディスク構成設定

指定されたディスク構成およびパーティションレイアウトに基づき、diskpartスクリプトを生成し、ターゲットディスクへの適用コマンドを組み込む。

**参加者:** generator_engine.js (system)、DiskModifier (system)、GenerationContext (system)、XmlNode (windowsPE) (system)

**メッセージフロー:**
- generator_engine.js → DiskModifier: process() 呼び出し
- DiskModifier → GenerationContext: getVal('PartitionLayout'), getVal('RecoveryMode') 取得
  - GenerationContext ← DiskModifier: PartitionLayout='GPT', RecoveryMode='Partition' 返却
- DiskModifier → DiskModifier: バリデーション: スクリプトパスや内容の空白・不整合チェック
- DiskModifier → DiskModifier: GPT用ディスク区画割り当て diskpart コマンド生成
- DiskModifier → DiskModifier: RecoveryMode=='Partition' による Windows インストール領域縮小 & 回復区画追加コマンドの適用
- DiskModifier → GenerationContext: writeToFilePE('X:\diskpart.txt', コマンド配列)
- DiskModifier → GenerationContext: xml (windowsPE) -> RunSynchronousCommand に diskpart.exe 呼び出し設定注入
  - DiskModifier ← generator_engine.js: 処理完了

```mermaid
sequenceDiagram
    participant engine as generator_engine.js
    participant disk_mod as DiskModifier
    participant context as GenerationContext
    participant xmlnode as XmlNode (windowsPE)
    engine->>disk_mod: process() 呼び出し
    disk_mod->>context: getVal('PartitionLayout'), getVal('RecoveryMode') 取得
    context-->>disk_mod: PartitionLayout='GPT', RecoveryMode='Partition' 返却
    disk_mod->>disk_mod: バリデーション: スクリプトパスや内容の空白・不整合チェック
    disk_mod->>disk_mod: GPT用ディスク区画割り当て diskpart コマンド生成
    disk_mod->>disk_mod: RecoveryMode=='Partition' による Windows インストール領域縮小 & 回復区画追加コマンドの適用
    disk_mod->>context: writeToFilePE('X:\diskpart.txt', コマンド配列)
    disk_mod->>context: xml (windowsPE) -> RunSynchronousCommand に diskpart.exe 呼び出し設定注入
    disk_mod-->>engine: 処理完了
```

## ブロートウェア削除

セットアップ後にシステムのクリーンな状態を維持するため、指定されたプリインストールアプリを自動削除するPowerShellスクリプトを構築し、FirstLogon/Specialize シーケンスに登録する。

**参加者:** generator_engine.js (system)、BloatwareModifier (system)、GenerationContext (system)、PowerShellSequence (specialize) (system)、PowerShellSequence (userOnce) (system)

**メッセージフロー:**
- generator_engine.js → BloatwareModifier: process() 呼び出し
- BloatwareModifier → GenerationContext: getBool('RemoveCopilot'), getBool('RemoveOneDrive'), getBool('Remove3DViewer') 取得
  - GenerationContext ← BloatwareModifier: 削除フラグ状態返却
- BloatwareModifier → BloatwareModifier: 選択されたアプリ名（*Microsoft.Copilot*等）のワイルドカード配列化
- BloatwareModifier → GenerationContext: embedTextFile('RemovePackage.ps1', Remove-AppxProvisionedPackage 削除スクリプト)
- BloatwareModifier → PowerShellSequence (specialize): append(RemovePackage.ps1 実行コマンド追加)
- BloatwareModifier → PowerShellSequence (userOnce): OneDrive等に対する個別レジストリ/サイレントアンインストール処理のコマンド追加
  - BloatwareModifier ← generator_engine.js: 処理完了

```mermaid
sequenceDiagram
    participant engine as generator_engine.js
    participant bloatware_mod as BloatwareModifier
    participant context as GenerationContext
    participant specialize_seq as PowerShellSequence (specialize)
    participant useronce_seq as PowerShellSequence (userOnce)
    engine->>bloatware_mod: process() 呼び出し
    bloatware_mod->>context: getBool('RemoveCopilot'), getBool('RemoveOneDrive'), getBool('Remove3DViewer') 取得
    context-->>bloatware_mod: 削除フラグ状態返却
    bloatware_mod->>bloatware_mod: 選択されたアプリ名（*Microsoft.Copilot*等）のワイルドカード配列化
    bloatware_mod->>context: embedTextFile('RemovePackage.ps1', Remove-AppxProvisionedPackage 削除スクリプト)
    bloatware_mod->>specialize_seq: append(RemovePackage.ps1 実行コマンド追加)
    bloatware_mod->>useronce_seq: OneDrive等に対する個別レジストリ/サイレントアンインストール処理のコマンド追加
    bloatware_mod-->>engine: 処理完了
```
