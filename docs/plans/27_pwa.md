# 27. PWA 対応

## 目的

ホーム画面に追加して起動できるようにし、`29` の Web Push（iOS ではホーム画面に追加した PWA でのみ利用可能）の前提を整える。

## スコープ

- Web App Manifest（`src/app/manifest.ts`）
  - 名前・短縮名・テーマカラー（`04` のデザイントークンに合わせる）・`display: standalone`・アイコン（192px／512px、maskable 含む）
- Service Worker（`public/sw.js`）
  - ライブラリ（`next-pwa` 等）は使わず手書きにする。OpenNext の出力構造に依存しないようにするため
  - キャッシュ対象は静的アセット（`/_next/static/`）とオフライン時のフォールバックページのみとし、記録データを含むページ・API はキャッシュしない（常に最新の記録を表示するため）
  - `29` で Push イベントのハンドラを追加できる構造にしておく
- Service Worker の登録処理（クライアントコンポーネント。`layout.tsx` にマウント）
- iOS 向けのメタタグ（`apple-touch-icon`、`apple-mobile-web-app-*`）
- オフライン時のフォールバックページ（`src/app/offline/page.tsx`）
- Lighthouse の PWA 監査で「インストール可能」になることの確認手順を `README.md` に記載

## 対象外

- オフラインでの記録入力・同期（記録はオンライン前提とする）
- Web Push（`29`）
- アプリストアへの公開（TWA 等）

## 依存 PR

- `01`（プロジェクト基盤構築）
- `04`（デザインシステム。テーマカラー・アイコンの元デザイン）

## 変更・追加内容

- `src/app/manifest.ts`
- `public/sw.js`、`public/icons/`
- `src/features/pwa/ServiceWorkerRegistration.tsx`
- `src/app/layout.tsx`・`src/app/offline/page.tsx`
- `README.md`

## DB マイグレーション

なし

## 受け入れ条件

- Chrome（Android・デスクトップ）で「ホーム画面に追加」「アプリをインストール」が提示され、standalone で起動する
- iOS Safari で「ホーム画面に追加」すると standalone で起動する
- オフライン時にフォールバックページが表示される
- Service Worker の更新時に古いキャッシュが破棄される
- Lighthouse の PWA 監査で「インストール可能」の項目を満たす
