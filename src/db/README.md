# DB 設計規約

Cloudflare D1（SQLite 互換）上で Drizzle ORM を使う際に、以降の全テーブルが従う共通規約をまとめる。

## マイグレーション運用フロー

- スキーマ定義は `src/db/schema/*.ts` に配置し、`src/db/schema/index.ts` からまとめて export する
- `pnpm db:generate`（`drizzle-kit generate`）でスキーマ定義から SQL マイグレーションファイルを `drizzle/` 配下に生成する
- 生成したマイグレーションは `pnpm db:migrate:local`（`wrangler d1 migrations apply DB --local`）でローカル D1 に適用する
  - 本番適用は `pnpm db:migrate:remote`（`--remote`）。実行タイミング・認証情報は `docs/deploy.md` を参照
- drizzle-kit 自身のマイグレーター（`drizzle-kit push` 等）は使わない。D1 はネットワーク越しの直接接続ができないため、`wrangler d1 migrations apply` に運用を統一する
- `wrangler.toml` の `[[d1_databases]].migrations_dir` を `drizzle` に設定し、drizzle-kit の出力先と wrangler の適用先を一致させている

## 共通カラム規約

- すべての記録テーブルは `cat_id`（`cats.id` への外部キー）を持つ。例外は「支出記録」の節を参照
- すべての記録テーブルは、その記録を代表する発生日時（UTC の datetime、`integer` の unix タイムスタンプで保持）を 1 列持つ。列名はテーブルのドメインに合わせてよいが、どの列が代表の発生日時かを次の一覧で管理する。タイムライン機能（`14`）はこの一覧に従って各テーブルを集約する

  | テーブル             | 代表の発生日時列  |
  | -------------------- | ------------------ |
  | `feeding_records`    | `occurred_at`       |
  | `poop_records`       | `occurred_at`       |
  | `weight_records`     | `occurred_at`       |
  | `vomit_records`      | `occurred_at`       |
  | `water_records`      | `occurred_at`       |
  | `shampoo_records`    | `performed_at`      |
  | `cleaning_records`   | `performed_at`      |
  | `symptoms`           | `onset_at`          |
  | `medication_doses`   | `occurred_at`       |
  | `hospital_visits`    | `visited_at`        |

  （`medications` 自体は予定・マスタ的な情報のため、タイムラインの対象は実績である `medication_doses` とする）

- 日付のみを表す列（生年月日・お迎え日など時刻を持たない情報）は `text` 型で ISO8601 の日付文字列（`YYYY-MM-DD`）として保持する
  - 生年月日（`cats.birth_date`）は年のみ・年月のみの入力も受け付ける。その場合も未入力の月・日を 1月・1日で補完した `YYYY-MM-DD` で保持し、わかっている範囲は `cats.birth_date_precision`（`year`・`month`・`day`）で別に持つ。年齢・誕生日の判定は補完した日付をそのまま使い、表示やフォームの初期値だけが精度を参照する
- 発生日時・作成日時・更新日時など時刻を持つ列は `integer("...", { mode: "timestamp" })`（unix タイムスタンプ）で保持する

## ユーザーと家（`users`・`households`・`household_members`・`sessions`）

- アプリの利用者（`users`）と、猫を飼っている「家」（`households`）を表す。家には 1 名以上のユーザー
  （`household_members`、`household_id` + `user_id` の複合主キー）と複数の猫（`cats.household_id`）が所属する
- ユーザーは所属する家の猫だけを参照・編集できる。ページ・Server Action・Route Handler・MCP 用の RPC
  （`src/worker.ts` の `McpRpc`）は、いずれも `src/features/households/queries.ts` の
  `getCatForUser`・`listCatsForUser`・`accessibleCatIdsQuery` で絞り込む（認可の入口は
  `src/features/auth/session.ts` の `requireUser`・`requireCatAccess`）
  - 猫に紐付くテーブル（記録・通知など）は `cat_id` 経由で家に紐付くため、家の列は持たない
  - 支出記録・ごはん商品・ごはんプリセットは、現時点では家に紐付けず全ユーザーで共通
  - Web Push の購読（`push_subscriptions.user_id`）は購読したユーザーを持ち、通知はその猫の家のメンバーの
    購読にだけ送る（`src/features/push/targets.ts`）。ユーザーの導入前の購読（NULL）には送らない
- `users.role` はアプリ全体の権限（`admin`・`member`）。`/login` のログインボタンで最初に作られる
  ユーザーは `admin`
- 家の中での権限は `household_members.role`（`owner`・`member`）で持つ。今はオーナーを 1 名で運用し、
  移譲は 2 人のロールを 1 つの UPDATE 文で入れ替える（`src/features/households/ownership.ts`）。
  将来オーナーを複数にできるよう、オーナーの人数はスキーマでは制限しない
- 家の名前の変更とメンバーを家から外す操作はオーナーだけができ、オーナーは家から抜けられない
  （`src/features/households/management.ts`）。オーナーかどうかの判定は UPDATE・DELETE の WHERE に
  含め、移譲と同時に操作されても元のオーナーの操作が通らないようにする
- 家への招待は `household_invitations` に保存する（`src/features/households/invitations.ts`）
  - 招待 URL（`/invitations/{トークン}`）のトークンそのものは保存せず、`sessions` と同じく SHA-256 の
    ハッシュ（`token_hash`）だけを持つ。そのため URL を表示できるのは発行したときだけ
  - 発行・無効化はオーナーだけができる。オーナーかどうかの判定は INSERT・DELETE の WHERE に含める。
    無効化は行の削除で、期限切れで未使用の行は同じ家で次に発行したときに削除する
  - 1 つの招待で参加できるのは 1 人だけ。参加したユーザーを `accepted_by_user_id` に残し、使用済みの行は
    削除しない。参加時は、未使用・期限内・まだメンバーでないことを WHERE に含めた UPDATE で先に招待を
    使用済みにし、更新できたときだけ `household_members` に追加する（同時に参加しても 1 人だけが通る。
    すでにメンバーのユーザーが開いても招待は使用済みにならない）
- ログインセッションは `sessions` に保存する。主キーはセッショントークンの SHA-256（`token_hash`）で、
  トークンそのものは Cookie にだけ持つ。ログアウトで行を削除し、期限切れの行は同じユーザーが次に
  ログインしたときに削除する（`src/features/auth/sessions.ts`）
- `cats.household_id` は、家の導入（`0036`）より前から登録されていた猫を残すため nullable。
  NULL の猫はどのユーザーからも見えないため、`scripts/link-household.mts`（`pnpm household:link`）で
  家に紐付ける（`docs/deploy.md` 参照）

## ごはん記録（`feeding_records`・`feeding_record_items`・`feeding_presets`・`feeding_preset_items`）

- `feeding_records.mode` は記録方法で、`strict`（厳格モード）と `approximate`（あいまいモード）を持つ。
  モードは記録単位で選び、1 回の食事の中で商品ごとにモードを混在させない
  - 厳格モードの明細は `given_amount_g`・`leftover_amount_g`・`estimated_intake_g`・`estimated_kcal`
    を持ち、`given_amount_level`・`leftover_level` は NULL
  - あいまいモードの明細は段階での量 `given_amount_level`（`less`・`normal`・`more`）と
    `leftover_level`（`none`・`little`・`most`）を持ち、グラム単位の量・推定値はすべて NULL。
    摂取量・カロリーを計算しないため、グラフの集計からも除外する
- `feeding_presets.mode` も同様で、厳格モードのプリセットの明細は `given_amount_g`、
  あいまいモードのプリセットの明細は `given_amount_level` を持つ

## 支出記録（`expense_records`・`expense_record_cats`・`expense_record_hospital_visits`）

- 病院代・ごはん・猫砂などの支出を家計簿として月ごとに集計するためのテーブル（`38`）
- 支出はすべての猫で共通のため、`expense_records` は「共通カラム規約」の例外として `cat_id` を持たない。
  関連する猫は `expense_record_cats`（`expense_record_id` + `cat_id` の複合主キー）で多対多に紐付ける
  - 猫のタイムライン（`14`）と一覧の「{猫名}のみ」の絞り込みは、この中間テーブル経由で解決する
  - 紐付けが 0 件の支出記録も「どの猫にも紐付かない共通の支出」として許容する。猫を削除したときは
    中間テーブルの行だけを削除し、支出記録自体は残す（`src/features/cats/actions.ts`）
- `spent_at` は支出日。フォームの入力は日付のみで、時刻は `00:00`（UTC）として保存する
- 病院代としての通院記録との紐付けは `expense_record_hospital_visits`（`expense_record_id` +
  `hospital_visit_id` の複合主キー）で持つ。一度の通院で複数の猫を診てもらい、まとめて支払うことが
  あるため、1 件の支出に複数の通院記録を紐付けられる
  - 通院記録の「病院代」は 1 つの金額しか持たないため、同じ通院記録に複数の支出が紐付かないよう
    `hospital_visit_id` に一意インデックスを設定する
  - 通院記録を紐付けられるのはカテゴリ「病院」の支出で、支出日と同じ日の通院記録に限る。
    カテゴリを「病院」以外にしたときは紐付けを外す。紐付けた通院記録の猫は `expense_record_cats` にも追加する
  - 通院記録・支出記録のどちらを削除するときも、この中間テーブルの行だけを削除し、相手の記録は残す
  - 通院記録と病院代の作成・更新・削除は、同じ `db.batch` にまとめる
  - 複数の通院記録で共有している支出は、通院記録の病院代を空にしても支出記録を削除せずその通院記録との
    紐付けだけを外し、受診日を変えても支出日を変えない（`src/features/expenses/hospitalVisitExpense.ts`）
- 月別検索用に `spent_at` のインデックスを設定する

## 画像・動画（`media_assets`）

- 画像・動画は個別の記録テーブルにカラムを持たせず、`media_assets` テーブルで一元管理する
- `recordType`（例: `"poop_record"`）+ `recordId` の polymorphic な組で対象レコードに紐付ける。使える `recordType` は `src/features/media/recordTypes.ts` で管理する
- `catId` は猫に紐付かないメディア（ごはん商品画像など）を許容するため nullable
- 書き込み実装済み（`docs/plans/18_media_upload_foundation.md`）。R2 との連携・行の作成・削除は `src/features/media/storage.ts` に集約し、Route Handler・各記録の削除アクションはこれを通して操作する
  - `objectKey`・`thumbnailObjectKey`：R2 のオブジェクトキー（`{recordType}/{recordId}/{assetId}` と `...{assetId}.thumb.webp`。フォームから先にアップロードした下書きは `pending/{assetId}` で、記録に紐付けた後もキーは変えない）
  - `mimeType`：先頭バイトで判定した形式（`Content-Type` ヘッダは信用しない）
  - `sizeBytes`・`thumbnailSizeBytes`：容量集計用。保存容量の上限判定は両者の `SUM` で行う
  - `width`・`height`：画像本体、または動画サムネイルの寸法（EXIF の回転を適用後）
  - `sortOrder`：同一レコード内の表示順
  - `(record_type, record_id)` にインデックス
- 記録フォームでは、ファイルを選んだ時点で `POST /api/media/uploads` が記録に紐付かない下書き（`recordType = "pending"`・`recordId` は自身の ID・`catId` は null）として保存する。フォームの保存時は asset ID だけを送り、各記録の保存アクションが `syncRecordMedia`（`src/features/media/attach.ts`）で下書きの紐付け・外された添付の削除・表示順の振り直しを行う
  - 紐付かないまま 24 時間を過ぎた下書きは、次回以降のアップロード時に削除する（下書きも保存容量に数える）
  - 下書きにはアップロードしたユーザー（`uploaded_by_user_id`）を保存し、本人だけが取得・削除・記録への紐付けをできる（`src/features/media/access.ts`・`attach.ts`）。asset ID を知っていても、別のユーザーの下書きは扱えない
- 記録を削除するときは、レコード本体より先に `deleteMediaAssetsByRecord(recordType, recordId)` を呼んで R2 のオブジェクトと行をまとめて削除する
- `cats.profile_media_asset_id` はプロフィール画像として使う `media_assets` 行（`recordType = "cat_profile"`・`recordId` と `catId` は猫の ID）への参照（nullable）。猫の編集画面でブラウザ側で正方形に切り抜いた画像を下書きとしてアップロードし、保存時に付け替える（`src/features/cats/applyProfileImage.ts`）。下書きの紐付けと猫の参照の更新は同じ `db.batch` で行い、差し替え・削除時はその時点で猫が参照していない古い画像だけを削除する（同時に別のリクエストが設定した画像を消さないため）。`cats` ⇄ `media_assets` が互いを参照するため、メディアの削除時は先に参照を外す（`src/features/cats/profileImage.ts`）

## 通知（`notifications`・`notification_settings`・`notification_preferences`）

- `28` で追加した、通知条件の判定結果を保持するテーブル群
- `notifications`・`notification_settings` は `cat_id` を持つが、記録テーブルではない（猫自身の行動・状態の記録ではなく、アプリが生成した通知・その設定のため）。タイムライン機能（`14`）の集約対象からは除外する（「共通カラム規約」の代表の発生日時列の一覧にも含めない）
- `notification_preferences` は猫に紐付かない、アプリ全体で 1 行だけの設定（通知時刻・タイムゾーン）だったが、通知時刻は 18:00（日本時間）固定になったため現在は未使用（後続で削除予定）
- 掃除対象ごとの通知時刻は `cleaning_targets.notify_time`（`HH:MM`、15 分刻み、nullable）で持つ。NULL の場合は 18:00 に通知する
- 詳細な判定ロジックは `src/features/notifications/` を参照

## AI 評価結果（`ai_evaluations`）

- AI 評価結果も個別の記録テーブルにカラムを持たせず、`ai_evaluations` テーブルで一元管理する
- `recordType` + `recordId` の polymorphic な組で対象レコードに紐付ける
- `model`・`promptVersion`・`aiOutput`・`evaluatedAt`・`userCorrection`（利用者による修正結果）・`mediaAssetId`（入力に使った画像・動画）を保存する
- MVP では AI 評価の呼び出しを実装せず、テーブル定義のみ用意する。実際の呼び出し実装は第3段階以降の PR で行う

## DB クライアント

- `src/db/client.ts` の `getDb()` で、Cloudflare bindings（`@opennextjs/cloudflare` の `getCloudflareContext()`）経由の D1 バインディングから Drizzle インスタンスを取得できる
- Server Actions・Route Handler からはこの `getDb()` を通して DB にアクセスする
- D1 は 1 クエリあたりのバインドパラメーターが 100 個までなので、`inArray` などに可変長の値を渡すときは `src/db/batch.ts` の `chunkForBoundParameters` で分割して実行する。明細など可変長の行を 1 回の INSERT にまとめるときも同様で、`chunkRowsForInsert` で行を分割し、分割した INSERT を同じ `db.batch` に並べる

## テストについて

- D1 バインディングは Vitest から直接扱えないため、単体テストでは `drizzle-orm/sql-js`（WASM 版 SQLite）を使い、`drizzle/` に生成済みのマイグレーションを適用したうえでスキーマ定義への型安全なクエリを検証する（`src/db/schema/cats.test.ts` を参照）
- ネイティブビルドが必要な `better-sqlite3` ではなく `sql.js` を採用しているのは、Docker コンテナ等ビルドツールチェーンを持たない環境でも追加設定なくテストを実行できるようにするため
