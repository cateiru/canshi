# AGENTS.md

このファイルは Claude（および他の AI コーディングエージェント）がこのリポジトリで作業する際のガイドとして参照する。
`CLAUDE.md` はこのファイルへのシンボリックリンク。

## リリースノートの記載（必須）

ユーザーから見て意味のある変更（機能追加・仕様変更・不具合修正など）を行った場合は、
コミットに含める形で `src/features/release-notes/release-notes.json` に変更点を追記すること。
表示専用ページ（`/release-notes`）や内部リファクタリング・テストのみの変更など、
ユーザーに影響しない差分では追記不要。

追記の手順:

1. `src/features/release-notes/schema.ts` の `releaseNoteSchema` に従い、配列の先頭ではなく
   末尾に新しいエントリを追加する（表示順は `src/features/release-notes/data.ts` が日付で
   自動的に並べ替えるため、記載位置は問わない）。
2. 各フィールド:
   - `version`: `package.json` の `version` を、このエントリと同じ値に更新すること
     （`package.json` の `version` とこのエントリの `version` を必ず一致させる。
     どれだけ上げるかは後述の「バージョンアップ」を参照）。
   - `date`: 変更をコミットする日付（`YYYY-MM-DD`）。
   - `title`: 変更内容を要約する短い見出し。
   - `items`: ユーザー向けの変更点を日本語の箇条書きで1件以上。実装の詳細ではなく、
     ユーザーが体感できる変化を書く。
3. `pnpm test` で `src/features/release-notes/data.test.ts` が通ることを確認する
   （JSON がスキーマ違反だとここで失敗する）。

リリースノートは `/release-notes` ページ（設定ページ「更新情報」からも遷移可能）で
一覧表示される。

**1 PR = 1 リリースノートエントリ。** 同じ PR の中で追記や修正が発生し複数エントリに
分かれてしまった場合も、最終的にはその PR の変更点として 1 件のエントリにまとめること
（`items` は複数行の箇条書きにしてよい）。

## ヘルプの更新

画面の操作や記録の項目を変えたときは、ヘルプ（`/help/*`）の説明とスクリーンショットも合わせて
更新すること。構成とスクリーンショットの撮り直し方は [`src/features/help/README.md`](src/features/help/README.md) を参照。

## バージョンアップ（必須）

上記のリリースノートを追記する際、`version` をどれだけ上げるか（パッチ／マイナー／
メジャー）を判断し、`package.json` の `version` と一致させる必要がある。判断基準と
具体的な更新手順は `.codex/skills/version-bump/SKILL.md`
（Claude からは `.claude/skills/version-bump/SKILL.md` としても参照可能。実体は同じ
ファイルへのシンボリックリンク）を参照すること。

**1 PR = 1 回のバージョンアップ。** リリースノートエントリと同様、1 PR につき
バージョンの上げ幅は 1 回分（パッチ 1 つ、またはマイナー 1 つ）とする。

## skill の作成・改修

このリポジトリの skill（`version-bump` など）は `.codex/skills/<skill-name>/SKILL.md`
に実体を置き、`.claude/skills/<skill-name>` はそこへのディレクトリシンボリック
リンクとする。新しい skill を作る、または既存の skill を直すときは
`.codex/skills/skill-creation/SKILL.md`（Claude からは
`.claude/skills/skill-creation/SKILL.md` としても参照可能。実体は同じ
ディレクトリへのシンボリックリンク）に従うこと。

## デプロイ

メインアプリは、Cloudflare 側の GitHub App（Workers Builds）で自動的にデプロイされる。
`main` にマージされるとデプロイがトリガーされるため、手動で `wrangler deploy` する必要はない。
管理画面（`packages/admin`）も同じく Workers Builds で、管理画面に関わるファイルが変わったときだけ
自動でデプロイされる（`main` 以外のブランチではプレビューが作られる）。

本番 D1 のマイグレーションは自動では適用されず、`pnpm db:migrate:remote` を手動で実行したときだけ
適用される。マイグレーションを含む PR は、マージと同時に新しいコードがデプロイされることを前提に、
適用のタイミング（マージ前に適用してよいか）を PR 本文に書くこと。
詳細は [`docs/deploy.md`](docs/deploy.md) の「デプロイ手順」を参照。

## コードレビュー

PR のレビューコメント（インラインコメント・レビュー本文・サマリーを含む）は、
コードやエラーメッセージの引用を除き、必ず日本語で書くこと。

## レイヤー構成

機能ごとのコードは `src/features/<機能>/` にまとめ、その中を DDD のレイヤードアーキテクチャにならって
4 つのディレクトリに分ける。依存してよいのは外側から内側への向きだけ。

- `presentation/`：画面のコンポーネント（`*.tsx`・CSS Modules）、Server Action（`actions.ts`・`*Actions.ts`）、
  外部接続（MCP のツール・API）の操作（`src/features/external-access/presentation/operations/**`）。ログイン・猫や家を参照できるかの確認、
  フォーム・操作の引数の解析、遷移やエラーの文言を受け持つ。`src/app/**`・`src/components/**` もこの層として扱う。
  application・infrastructure・domain を使ってよい。
- `application/`：ユースケース（`mutations.ts` など）。見つからない・無効などの判断をし、domain で中身を作って
  infrastructure のリポジトリで保存する。domain・infrastructure を使ってよい。
- `infrastructure/`：D1・R2 を読み書きする実装。リポジトリ（`<entity>Repository.ts`）と、画面・MCP 向けの
  読み取り（`queries.ts`・`*Queries.ts`）を置く。domain だけを使ってよい。
- `domain/`：DB に触れない業務の規則。エンティティ・値オブジェクト・リポジトリの interface・入力の規則
  （`schema.ts`）・純粋な計算（`calculations.ts`）・表示名（`labels.ts`）を置く。ほかの層・DB・Next.js・React に依存しない。

`shared`・`navigation`・`pwa`・`release-notes`・`help` は業務の規則を持たないため、層に分けずに置く。
`src/db/schema`（テーブル定義・型・定数）は、どの層から import してもよい。

### エンティティ・値オブジェクト・リポジトリ

- エンティティは `domain/<entity>.ts` に置く（例：`water-records/domain/waterRecord.ts`）。型は
  `@/db/schema` の行の型をそのまま使い、保存する中身の型（`WaterRecordContent`）と、入力から中身を作る
  関数（`toWaterRecordContent`）を定義する。保存時に求める値（推定飲水量など）はこの関数で計算する。
- 値オブジェクトは、ID を持たず値で比べる、規則を持つ値。readonly の型と、作る・計算する関数を同じモジュールに
  置く（例：`waterAmount.ts`・`catWeight.ts`・`cleaningFrequency.ts`・`medicationPeriod.ts`）。
  Server Component から Client Component へ渡せるよう、エンティティ・値オブジェクトは class にしない。
  DB の列は平らなままにし、エンティティの関数の中で値オブジェクトを作って列に戻す。
- リポジトリの interface は `domain/<entity>Repository.ts` に、D1 の実装は `infrastructure/<entity>Repository.ts`
  に置き、`createXxxRepository(d1?)` で作る。
- 複数のテーブルを同時に書き換える処理（従属する行の削除・参照の解除・通知の完了など）は、D1 では batch でしか
  原子的にできないため、リポジトリのメソッドの中で 1 つの batch にする。家のメンバー・オーナーであることなど、
  書き込みの直前に変わりうる条件も、リポジトリの文の中で確かめる（`addForMember`・`renameAsOwner` など）。
- 記録（`src/db/README.md` の 14 テーブル）を書き込むリポジトリのメソッドは、操作した人（`RecordActor`）を受け取り、
  `src/db/recordChangeLog.ts` の `insertRecordChangeLog` を同じ batch に並べて履歴を残す。presentation で画面なら
  `userActor(user)` を、外部接続の操作なら `OperationAccess` の `actor` を渡す。
- 読み取りはリポジトリに入れず、`infrastructure/queries.ts` に画面・MCP 向けの関数として置く。presentation は
  読み取りでは queries を直接使ってよい。リポジトリに分けた書き込みは、必ず application を通す。

### 守ること

- 層の依存の向きは Biome の `noRestrictedImports`（`biome.json` の `overrides`）で禁止している。
  - presentation から `@/db/client`・`@/db/batch`・`drizzle-orm` を import しない。
  - application から DB と presentation を import しない。
  - infrastructure から application・presentation を import しない。
  - domain から DB・`next`・`react`・`@opennextjs/cloudflare` と、ほかの層を import しない。
  - overrides は層ごとに対象が重ならないようにする。
- application の関数（`mutations.ts` など）と queries の関数は、最後の引数で D1 を `d1?: D1Database` として受け取る。
  外部接続の操作は `ctx.env.DB` を渡す。画面からは省略してよい。
  画像（R2）の削除を伴う関数（`deleteCatForUser` など）は、今は画面からだけ使うため受け取らない。
- 認可（`requireCatAccess`、外部接続の権限の確認）は、presentation で行う。application の関数には確認済みの ID を渡す。
  ただし、確認から書き込みまでの間に家から外された場合に備えて、リポジトリの文の中でも所属を確かめる場合がある
  （`createFoodProduct` など）。
- 次の処理は技術的な処理として infrastructure に置いたまま、リポジトリには分けていない。presentation から直接使ってよい。
  - ログインとセッション（`auth/infrastructure/sessions.ts`・`users.ts`・`oidc.ts`）
  - OAuth の KV・MCP の権限と利用状況（`mcp/infrastructure/**`）
  - Push の送信（`push/infrastructure/sendPush.ts`・`sendTestPush.ts`）
  - R2 への保存・配信（`media/infrastructure/storage.ts`・`serve.ts`）と、共通のごはん商品の画像の加工（`image.ts`）
  - プロフィール画像の付け替え（`cats/infrastructure/applyProfileImage.ts`・`users/infrastructure/applyUserIcon.ts`）

## 外部接続（AI との接続・API）

MCP のツールと API（`/api/v1`）のエンドポイントは、同じ操作（`src/features/external-access/presentation/operations/**`）を
呼ぶ。操作は通信の方式に依存させず、呼んだものの呼び方（「この接続」「このトークン」）は `ctx.caller` を使う。

- 操作を足したら、`src/features/api/domain/routes.ts` にエンドポイントも足す（すべての操作に 1 つずつあることをテストで
  確かめている）。操作の説明・エラーのメッセージの操作の名前（`list_cats` など）は、API ではエンドポイントに置き換わる
- 公開した API のパス・引数・応答の項目を、互換性のない形で変えない。変えるときは新しい版（`/api/v2`）を作る

## その他

- 開発コマンド・ディレクトリ構成は [`README.md`](README.md) を参照。
- DB 設計規約は [`src/db/README.md`](src/db/README.md) を参照。
- メインアプリ・管理画面（`packages/admin`）・今後の LP などで共通の実装（デザイントークン・UI コンポーネント）は
  `packages/shared`（`@canshi/shared`）に置く。Next.js・Hono などに依存しないものだけを置き、リンク・ページ移動は
  props（`linkComponent`・`navigate`）で差し込む。メインアプリの画面は今までどおり `@/components/ui`（`next/link` を
  差し込んだもの）から import する。詳細は [`packages/shared/README.md`](packages/shared/README.md) を参照。
