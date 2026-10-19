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
- ユーザーは所属する家の猫だけを参照・編集できる。ページ・Server Action・Route Handler・MCP のツール
  （`src/features/mcp/agent.ts`）は、いずれも `src/features/households/queries.ts` の
  `getCatForUser`・`listCatsForUser`・`accessibleCatIdsQuery` で絞り込む（認可の入口は
  `src/features/auth/session.ts` の `requireUser`・`requireCatAccess`）。MCP のツールはさらに、
  ユーザーが接続ごとに許可した読み取り範囲（`mcp_permissions`）で絞り込む
  - 猫に紐付くテーブル（記録・通知など）は `cat_id` 経由で家に紐付くため、家の列は持たない
  - 支出記録は猫ではなく家に属するため `expense_records.household_id` を持つ（「支出記録」の節を参照）
  - ごはん商品・ごはんプリセットも猫ではなく家に属するため `food_products.household_id`・
    `feeding_presets.household_id` を持つ（「ごはん記録」の節を参照）
  - Web Push の購読（`push_subscriptions.user_id`）は購読したユーザーを持ち、通知はその猫の家のメンバーの
    購読にだけ送る（`src/features/push/targets.ts`）。ユーザーの導入前の購読（NULL）には送らない
- ログインは Cloudflare Access の OIDC で行い、ID トークンのメールアドレスだけを受け取る。DB には
  メールアドレスそのものを保存せず、環境変数の SALT（`EMAIL_HASH_SALT`）を使って argon2id で
  ハッシュにした値を `users.email_hash`（一意）に保存し、同じユーザーかどうかもこの値で判定する
  （`src/features/auth/emailHash.ts`・`src/features/auth/users.ts`）
  - 初めてログインしたメールアドレスでは、ユーザーを新しく作る。名前はメールアドレスから作らず、
    既定の名前にする
  - OIDC の導入前に作られたユーザーは `email_hash` が NULL のため、`pnpm user:link-email` で紐付ける
- `users.role` はアプリ全体の権限（`admin`・`member`）。ユーザーが 1 件もないときに最初に
  ログインしたユーザーは `admin`
- `users.name`・`users.icon_media_asset_id` は本人がアカウント設定の「プロフィールを編集する」（`/settings/account/profile`）で変えられる。
  アイコン画像は同じ家のメンバーにも表示する（詳細は「画像・動画」の節）
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
    削除しない。参加時は、未使用・期限内・まだメンバーでないことを WHERE に含めた UPDATE で招待を
    使用済みにし、同じ `db.batch` の INSERT で `household_members` の行を作る。UPDATE は参加の処理ごとに
    発行した ID（`acceptance_id`）を書き込み、INSERT はその ID の招待からだけ行を作るため、片方だけが
    反映されることはなく、同時に参加しても 1 人だけが通る。すでにメンバーのユーザーが開いても招待は
    使用済みにならない
  - `created_at` は秒単位のため、未使用の招待の一覧は同じ秒に発行したものを rowid（挿入順）で新しい順に並べる
- ログインセッションは `sessions` に保存する。主キーはセッショントークンの SHA-256（`token_hash`）で、
  トークンそのものは Cookie にだけ持つ。ログアウトで行を削除し、期限切れの行は同じユーザーが次に
  ログインしたときに削除する（`src/features/auth/sessions.ts`）
  - アカウント設定（`/settings/account`）の「ログイン中の端末」の一覧のため、ログインしたブラウザの
    User-Agent（`user_agent`、512 文字までに切り詰める）を保存する。生の値を保存し、表示するときに
    「iPhone・Safari」のような端末名に変換する（`src/features/auth/deviceName.ts`）。`0042` より前の
    セッションは NULL で、「不明な端末」と表示する
  - 端末を指定してログアウトするときは、`token_hash` を画面に出さず、画面用の ID（`id`、一意）で指す。
    `id` は DB 側の既定値（`lower(hex(randomblob(16)))`）で振るため、既存の行にも値が入る。削除は
    ユーザーの一致を WHERE に含め、別のユーザーのセッションは削除できない
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
- ごはん商品（`food_products`）とプリセット（`feeding_presets`）は家（`household_id`）に属し、その家の
  猫で共通のため `cat_id` を持たない
  - 商品・プリセットは登録時に選んだ家に属し、登録後に家は変えない。一覧は所属する家ごとにまとめて表示し、
    参照・編集・削除はその家のメンバーだけができる（`src/features/food-products/queries.ts`・
    `src/features/feeding-presets/queries.ts`）
  - プリセットの明細の商品は、プリセットと同じ家の商品に限る。ごはん記録の明細の商品は、猫の家の商品に限る
    （`src/features/feeding-presets/actions.ts`・`src/features/feeding-records/actions.ts`）
  - 猫が別の家へ引っ越したときは、ごはん記録は猫と一緒に移り、商品・プリセットは元の家に残る。引っ越す前の
    記録の編集では、その記録ですでに使っている元の家の商品をそのまま選べる
  - 商品画像（`media_assets`、`record_type = "food_product"`）は、商品の家のメンバーだけが参照できる
    （`src/features/media/access.ts`）
  - `household_id` は、家に紐付けられなかった導入前の商品・プリセットを残すため nullable（`0040` では
    紐付けない）。NULL の商品・プリセットはどのユーザーからも見えないため、`scripts/link-household.mts`
    （`pnpm household:link`）で家に紐付ける
  - 家ごとの一覧用に `(household_id, created_at)` のインデックスを設定する
- ごはん商品はメーカー名（`manufacturer`）・種類（`texture_type`、`dry`・`wet`・`soup`）・対象の猫
  （`life_stages`）・対象の猫種（`target_breed`）を持つ（`0046`）。共通のごはん商品（次の節）を検索で
  絞り込める形で持つ
  - `life_stages` は `kitten`・`adult`・`senior`・`care`（療養）の JSON 配列で、複数を選べる。空配列は未設定。
    `src/db/schema/food-products.ts` の `FOOD_PRODUCT_LIFE_STAGES` の順に並べて保存し、検索では `json_each` で絞り込む
  - `target_breed` は `cats.breed` と同じく猫種の候補（`src/features/cats/breeds.ts`）から選ぶか自由に入力し、
    NULL はすべての猫種向けを表す。`manufacturer` も NULL は未入力

## 共通のごはん商品（`catalog_food_products`）

- どの家のユーザーも、ごはん商品を登録するときに検索して家に追加できる商品（#283、`0047`）。家に属さず、
  管理画面（`packages/admin`）だけが登録・編集・削除する。列は `food_products` から `household_id` を除き、
  内容量の候補（`package_sizes`）を足したもの
- 家に追加するときは、内容を写した `food_products` の行を作る（`src/features/catalog-food-products/actions.ts`）。
  追加した商品は手動で登録した商品と同じく家ごとに自由に編集でき、共通のごはん商品の変更・削除は反映しない
  - 追加は、共通のごはん商品と追加先の家のメンバーの行を結合した `INSERT ... SELECT` の 1 文で行い、
    判定と追加の間に家から外された場合や商品が削除された場合は追加しない
  - `food_products.catalog_food_product_id` に追加元を残し、検索結果で「追加済み」を表示する。手動で登録した
    商品は NULL。同じ家に同じ共通のごはん商品を 2 回追加しないよう `(household_id, catalog_food_product_id)` に
    一意インデックスを設定し、追加の INSERT は衝突したら何もしない（古い画面や同時の追加は、追加済みとして扱う）。管理画面で共通のごはん商品を削除したときは、外部キーの `ON DELETE SET NULL` で NULL になり、
    家の商品は残る（drizzle-kit は `ALTER TABLE ... ADD` の `ON DELETE` を出力しないため、`0047` に手で追記した）
- 検索は商品名・メーカー名のキーワード（空白で区切ったすべての語を含む）と、メーカー名・種類・区分・
  対象の猫（`json_each`）・対象の猫種で絞り込む。LIKE に渡す入力の `%`・`_` はエスケープする
  （`src/features/catalog-food-products/queries.ts`）
- 画像は `media_assets`（`record_type = "catalog_food_product"`・`cat_id` と `uploaded_by_user_id` は NULL）に
  1 枚だけ持つ。管理画面はブラウザで縮小した画像（長辺 800px 以下・メタデータのない JPEG であることをサーバーでも
  確かめる）だけを保存し、サムネイルは作らない（`thumbnail_object_key` は NULL）
  - ログイン中のユーザーなら誰でも参照できるが、メインアプリからは削除できない（`src/features/media/access.ts`）。
    メインアプリから添付先として選べないよう、`MEDIA_RECORD_TYPES` には含めない
  - 家に追加するときは、R2 から元データを読み出して通常のアップロードと同じ経路（`storeMediaAsset`）で
    家の商品の画像として保存し直す。家の商品の画像の差し替え・削除で共通のごはん商品の画像を消さないよう、
    R2 のオブジェクトは共有しない。保存できなかったときも商品は追加する
- 内容量は、容量違いの商品を 1 つにまとめるため複数の候補を持てる（#346、`0050`）。`package_sizes` に
  `{ amountG, unit }` の JSON 配列で、管理画面で並べた順に保存する（1〜10 件・同じ g と単位の組み合わせは重複させない）
  - 家に追加するときに候補から 1 つ選び、`food_products.package_amount_g`・`package_unit` に写す。追加の
    `INSERT ... SELECT` の中で、選んだ値（g と単位）がその時点の候補にあるかを `json_each` で確かめ、なければ
    追加しない（画面を開いてから候補が編集されたときに、候補にない内容量を追加しない）
  - 同じ家には、別の内容量を選んでも同じ共通のごはん商品を 1 件だけ追加する（上の一意インデックスのまま）
  - `package_amount_g`・`package_unit` は、`package_sizes` を追加する前のコードのために残し、管理画面は先頭の
    候補を書き続ける（後で削除する）。`0050` を適用してから管理画面をデプロイするまでの間は、古い管理画面が
    `package_amount_g`・`package_unit` だけを登録・更新する（`package_sizes` は空か、`0050` で埋めた値のまま残る）。
    その更新も反映するため、読む側は先頭の候補を `package_amount_g`・`package_unit` から取り、`package_sizes` からは
    2 件目以降だけを使う（`src/features/catalog-food-products/packageSizes.ts`）
- 検索結果の並び順のため `(manufacturer, name)` のインデックスを設定する

## 支出記録（`expense_records`・`expense_record_cats`・`expense_record_hospital_visits`）

- 病院代・ごはん・猫砂などの支出を家計簿として月ごとに集計するためのテーブル（`38`）
- 支出は家（`expense_records.household_id`）に属し、その家の猫で共通のため、`expense_records` は
  「共通カラム規約」の例外として `cat_id` を持たない。関連する猫は `expense_record_cats`
  （`expense_record_id` + `cat_id` の複合主キー）で多対多に紐付ける
  - 支出記録の一覧・グラフは、表示中の猫の家の支出を表示する。記録したページの猫の家を支出の家にし、
    家はクライアントから受け取らない（`src/features/expenses/actions.ts`）
  - 関連する猫・病院代として紐付ける通院記録は、支出と同じ家の猫のものに限る
  - 猫が別の家へ引っ越したときは、支出記録は元の家に残し、引っ越した猫とその通院記録との紐付けだけを
    猫の更新と同じ `db.batch` で外す（`src/features/cats/mutations.ts`）
  - 支出の添付（`media_assets`、`record_type = "expense"`）は、支出の家のメンバーだけが参照できる
    （`src/features/media/access.ts`）
  - `household_id` は、家に紐付けられなかった導入前の支出記録を残すため nullable（`0039` で、関連する猫の家、
    家が 1 つだけならその家に紐付けた）。NULL の支出記録はどのユーザーからも見えないため、
    `scripts/link-household.mts`（`pnpm household:link`）で家に紐付ける
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
- 家ごとの月別検索用に `(household_id, spent_at)` のインデックスを設定する

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
- `users.icon_media_asset_id` はアイコン画像として使う `media_assets` 行（`recordType = "user_icon"`・`recordId` はユーザーの ID・`catId` は null）への参照（nullable）。猫のプロフィール画像と同じく、切り抜いた画像を下書きとしてアップロードし、アカウント設定でプロフィールを保存するときに同じ `db.batch` で付け替え、ユーザーが参照していない古い画像だけを削除する（`src/features/users/applyUserIcon.ts`）。`users` ⇄ `media_assets` が互いを参照するため、メディアの削除時は先に参照を外す（`src/features/users/iconImage.ts`）
  - `user_icon` は記録への添付ではないため `MEDIA_RECORD_TYPES` に含めず、`POST /api/media` から直接アップロードさせない
  - 参照できるのは本人と同じ家のメンバー、削除できるのは本人だけ（`src/features/media/access.ts`）

## 通知（`notifications`・`notification_settings`・`notification_preferences`）

- `28` で追加した、通知条件の判定結果を保持するテーブル群
- `notifications` は、猫についての通知では `cat_id`、家についての通知（猫を問わないもの）では `household_id` を持ち、
  どちらか一方だけを必ず持つ（CHECK 制約 `notifications_target_check`）
  - 一覧・操作は、ユーザーの家の猫の通知と、ユーザーが所属する家の通知に限る（`src/features/notifications/access.ts`）。
    通知センターで猫を選んで絞り込んだときは、家についての通知は表示しない
  - Push は、猫についての通知はその猫の家のメンバー、家についての通知はその家のメンバーの購読にだけ送る
    （`src/features/push/targets.ts`）
  - `0044` で `cat_id` の NOT NULL を外すためにテーブルを作り直した。D1 では外部キー制約を無効にできず、
    DROP TABLE の暗黙の DELETE で `push_deliveries` の行が CASCADE で消えるため、退避してから戻している
- `notifications`・`notification_settings` は `cat_id` を持つが、記録テーブルではない（猫自身の行動・状態の記録ではなく、アプリが生成した通知・その設定のため）。タイムライン機能（`14`）の集約対象からは除外する（「共通カラム規約」の代表の発生日時列の一覧にも含めない）
- `notification_preferences` は猫に紐付かない、アプリ全体で 1 行だけの設定（通知時刻・タイムゾーン）だったが、通知時刻は 18:00（日本時間）固定になったため現在は未使用（後続で削除予定）
- 掃除対象ごとの通知時刻は `cleaning_targets.notify_time`（`HH:MM`、15 分刻み、nullable）で持つ。NULL の場合は 18:00 に通知する
- ごはんの時間は家ごとに `feeding_schedules`（`household_id`・`time`（`HH:MM`、15 分刻み、日本時間））で持ち、
  同じ家に同じ時刻は 1 つだけ（`(household_id, time)` の一意インデックス）。家のメンバーなら誰でも追加・変更・削除でき、
  メンバーかどうかの判定は INSERT ... SELECT・UPDATE・DELETE の WHERE に含める（`src/features/feeding-schedules/mutations.ts`）
  - 通知は猫ごとではなく、家についての通知（`notifications.household_id`）として家に 1 件生成する。種類は
    `feeding_time`・`feeding_not_recorded`、`reference_id` は `feeding_schedules.id`。`notify_at_time`・
    `remind_if_not_recorded` で時間ごとにそれぞれの通知を出すかを持つ。猫のいない家には出さない
  - 各時刻の前後の範囲は、前の時刻との中間から次の時刻との中間まで（時刻が 1 つなら前後 12 時間）。
    範囲は始まりを含み終わりを含まない半開区間で、1 件の記録が隣り合う 2 つの時刻の両方に数えられない。
    家のどれかの猫のごはん記録の `occurred_at`（naive UTC）が範囲内にあれば記録があるとみなす
    （`src/features/notifications/rules/feedingSchedule.ts`）
  - 記録がないときのリマインダーは、時刻の 1 時間後か次の時刻との中間の早いほうに出す。範囲の始まりから
    判定する時刻（範囲の終わりを越えない）までの記録を数える
  - 通知の INSERT は、ごはんの時間がまだ有効で範囲内に記録がないことを確かめる `INSERT ... SELECT` にし、
    判定してから INSERT するまでに記録・削除・オフにされた場合は作らない（`src/features/notifications/generate.ts`）。
    記録は判定した時刻ではなく INSERT する時点までのものを数え、スケジュール実行が遅れても判定後の記録を見落とさない
  - 直近の記録を猫ごとに期間で絞って読むため、`feeding_records` に `(cat_id, occurred_at)` のインデックスを設定する
  - ごはん記録を追加したときは、猫の家の未対応のごはんの通知を同じ `db.batch` で完了にする
  - ごはんの時間を削除したときは、その時間の未対応の通知を同じ `db.batch` で無視にする。通知をオフにしたときも、
    オフにした種類の未対応の通知を同じ `db.batch` で無視にする。対応済みの通知は、`reference_id` に外部キーがないため
    履歴として残す
- 詳細な判定ロジックは `src/features/notifications/` を参照

## MCP の OAuth（`oauth_kv_entries`）

- MCP の OAuth 認可サーバー（`@cloudflare/workers-oauth-provider`）のクライアント登録・認可・トークンを
  保存する。ライブラリは Workers KV に保存する作りのため、キーと値（JSON の文字列）をそのまま持つ
  KV と同じ形のテーブルにし、`src/features/mcp/d1KvStore.ts` で KV の操作を実装している
- キー・値の形式はライブラリが決めるため、アプリのコードから直接読み書きしない
- `expires_at` を過ぎた行は無いものとして扱い、定期実行で削除する

## AI との接続の読み取り範囲（`mcp_permissions`）

- MCP のツールから読み取れる家・猫・記録の種類を、ユーザーが許可した接続ごとに 1 行で持つ
  （`user_id` + `client_id` の複合主キー）。範囲はトークン（OAuth の `props`）には持たせず、ツールが
  呼ばれるたびに読む（`src/features/mcp/permissions.ts`）。設定の「AIとの接続」の接続ごとのページ
  （`/settings/ai-connections/[connectionId]`）と同意画面（`/oauth/authorize`）で変えられる
  - `client_id`: OAuth のクライアントの ID。クライアント・grant は `oauth_kv_entries` にあるため外部キーに
    しない。同じクライアントにもう一度同意すると古い grant は解除されるため、ユーザーの接続の中で
    クライアントの ID は重ならない。ツールは、リクエストごとにアクセストークンの grant から求めた
    クライアントの ID（`src/features/mcp/clientId.ts`）で行を選ぶ。求められないときは読み取りを断る
  - 接続を設定の「AIとの接続」から解除すると、その接続の行も消す
- 後から作った家・登録した猫も既定で読み取れるよう、許可したものではなく外したもの（拒否）を持つ。
  行が無い接続は、すべて読み取れる
  - `excluded_household_ids`: 外した家の ID（JSON の配列）。家は猫が今いる家で判定する
  - `excluded_cat_ids`: 外した猫の ID（JSON の配列）。家を外したときは、その家の猫も含める。猫が外した家から
    別の家へ引っ越しても、画面で見えていたとおり読み取れないままにするため
  - `excluded_record_types`: 猫の ID ごとの、外した記録の種類（JSON のオブジェクト）。誕生日・お迎え日は
    プロフィールから求めるため対象外で、猫を読み取れれば読み取れる
- 家・猫は外部キーにせず ID で持つ。削除された家・猫の ID が残っても、どの猫にも当てはまらなくなるだけで
  害はなく、次に保存したときに取り除かれる（保存時は、所属する家・参照できる猫の ID だけを残す）

## AI との接続を最後に使った日時（`mcp_connection_usages`）

- 設定の「AIとの接続」に表示する「最終接続日時」を、ユーザーが同意した接続（OAuth の grant）ごとに 1 行で持つ
  （`user_id` + `grant_id` の複合主キー、`0049`）。`/mcp` へのリクエストのうち、アクセストークンから
  grant を求められたものごとに更新する（`src/features/mcp/clientId.ts`・`src/features/mcp/usages.ts`）
  - D1 への書き込みを減らすため、前回の記録から 60 秒以内のリクエストでは更新しない。判定は UPSERT の
    `ON CONFLICT DO UPDATE ... WHERE` に含め、1 文で行う。記録は `ctx.waitUntil` で行い、失敗しても MCP の
    応答には影響させない
  - grant（`oauth_kv_entries` の `grant:{userId}:{grantId}`）が期限内で残っているときだけ書き込む。
    grant の確認と書き込みを 1 文で行い、記録と並んで接続を解除されても、解除で消した行を作り直さない
    （解除は grant を消してからこの行を消す）
- `mcp_permissions` と違い、クライアントの ID ではなく grant の ID で持つ。ライブラリは CIMD のクライアントで
  認可コードの渡し先が違う場合などに、同じクライアントの grant を複数残すため、クライアントの ID では一覧の
  別の接続の日時が混ざる
- grant は `oauth_kv_entries` にあるため外部キーにしない。接続を設定の「AIとの接続」から解除すると、その接続の
  行も消す。同じクライアントにもう一度同意したときや grant の期限が切れたときは、ライブラリや定期実行が grant
  だけを消すため、grant が無くなった行は定期実行で消す（`purgeOrphanedMcpConnectionUsages`）
- 導入前から使っている接続や、接続してからまだ使っていない接続には行が無く、「記録がありません」と表示する

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
