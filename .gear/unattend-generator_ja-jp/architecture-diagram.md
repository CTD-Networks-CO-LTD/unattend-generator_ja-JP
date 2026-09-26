# アーキテクチャ構成図

Windows無人セットアップ（クリーンインストール）向け自動応答ファイル（autounattend.xml）をブラウザまたは.NET環境で生成する、日本語環境特化型ジェネレーターシステム。

**クライアント層（応答ファイルジェネレーター画面）:**
- 応答ファイルジェネレーター画面 [HTML5 / Vanilla JS]
- インストール設定フォーム画面 [HTML Form (FormData)]

**アプリケーション・生成エンジン層:**
- クライアントサイドXML生成エンジン [JavaScript (GenerationContext, XmlNode)]
- ISO 9660 イメージビルダー [JavaScript (createIsoBlob)]
- UnattendGenerator .NETコアライブラリ [.NET 10 (C#)]
- サーバーレスAPI [Cloudflare Workers]

**プラットフォーム・実行インフラ層:**
- GitHub Pages (本番/プレビュー) [GitHub Pages]

**接続:**
- 応答ファイルジェネレーター画面 → インストール設定フォーム画面 (DOM Control)
- インストール設定フォーム画面 → クライアントサイドXML生成エンジン (In-Memory Function Call)
- クライアントサイドXML生成エンジン → ISO 9660 イメージビルダー (Internal Call)
- 応答ファイルジェネレーター画面 → サーバーレスAPI (HTTPS (POST/GET))
- GitHub Pages (本番/プレビュー) → 応答ファイルジェネレーター画面 (HTTPS)

```mermaid
flowchart TD
    subgraph client["クライアント層（応答ファイルジェネレーター画面）"]
        generator_ui["応答ファイルジェネレーター画面 (HTML5 / Vanilla JS)"]
        settings_form["インストール設定フォーム画面 (HTML Form (FormData))"]
    end
    subgraph application["アプリケーション・生成エンジン層"]
        unattend_engine_js["クライアントサイドXML生成エンジン (JavaScript (GenerationContext, XmlNode))"]
        iso_builder["ISO 9660 イメージビルダー (JavaScript (createIsoBlob))"]
        unattend_generator_dotnet["UnattendGenerator .NETコアライブラリ (.NET 10 (C#))"]
        cloudflare_worker["サーバーレスAPI (Cloudflare Workers)"]
    end
    subgraph infrastructure["プラットフォーム・実行インフラ層"]
        github_pages["GitHub Pages (本番/プレビュー) (GitHub Pages)"]
    end
    generator_ui -->|"DOM Control"|settings_form
    settings_form -->|"In-Memory Function Call"|unattend_engine_js
    unattend_engine_js -->|"Internal Call"|iso_builder
    generator_ui -->|"HTTPS (POST/GET)"|cloudflare_worker
    github_pages -->|"HTTPS"|generator_ui
```