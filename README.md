# PR #508 の比較画像

[PR #508](https://github.com/cateiru/canshi/pull/508) の見た目確認用スクリーンショットです。

- 修正前: `3d22b1c6ad765b7085fd73e6a88ffc9d35e07bda` の対象ファイルを読み込んで撮影
- 修正後: `4cbacecc5c80dddb1a1660589686b6a87094a4fc`
- 表示条件: 幅 320px、文字サイズ「特大」、ダークテーマ、パープル、コントラスト「上げる」
- 撮影対象: 既存の VRT 用テストデータ
- 撮影日: 2026-11-06
- 画像は変更箇所をブラウザで切り出したもの。表示倍率・テストデータは修正前後で共通

## 猫一覧

- `cats-before.png`: プロフィール画像が固定の 64px
- `cats-after.png`: 文字サイズに合わせて約 83px に拡大

## 見た目設定

- `appearance-before.png`: 選択肢のラベルが途中で改行される
- `appearance-after.png`: 選択肢ごとに折り返す

## 記録フォーム

- `form-before.png`: 日付が欠け、記録方法のラベルが途中で改行される
- `form-after.png`: 日付・時刻を縦に並べ、記録方法を選択肢ごとに折り返す。「?」と見出しのアイコンも拡大

## 設定メニュー

- `navigation-before.png`: メニューのアイコン・矢印が固定サイズ
- `navigation-after.png`: 文字サイズに合わせてアイコン・矢印を拡大

## チェックボックス

- `checkbox-before.png`: 枠とチェックが固定サイズ
- `checkbox-after.png`: 枠とチェックを文字サイズに合わせて拡大

## アカウントのプロフィール

- `profile-before.png`: 固定サイズの画像と編集ボタンの間で名前・IDが狭くなる
- `profile-after.png`: 画像と編集ボタンを拡大し、名前・IDを次の行に配置
