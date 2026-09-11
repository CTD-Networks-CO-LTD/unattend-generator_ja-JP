# unattend-generator_ja-JP プレビュー環境 (Preview Environment)

このディレクトリは、GitHub Pages のプレビュー環境用プレースホルダーです。

## 概要
- **プレビュー公開URL**: [https://ctd-networks-co-ltd.github.io/unattend-generator_ja-JP/preview/](https://ctd-networks-co-ltd.github.io/unattend-generator_ja-JP/preview/)
- **正規提供中サイト（本番）**: [https://ctd-networks-co-ltd.github.io/unattend-generator_ja-JP/](https://ctd-networks-co-ltd.github.io/unattend-generator_ja-JP/)

## 動作仕様
- `main` または `master` ブランチへのプルリクエストがマージされた際、GitHub Actions（`Deploy GitHub Pages` ワークフロー）により、最新の開発版資材が自動的に `/preview/` パス配下にビルド・デプロイされます。
- 本番公開サイト（ルート `/`）は最新の正式リリースタグ（`v*`）の安定版が維持され、直接の影響を受けません。
- 正式リリース（Release published）時にのみ、本番公開サイト（ルート `/`）へ最新資材が反映されます。

