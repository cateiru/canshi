# CANSHI

- 愛猫の日々の行動、健康状態、食事、通院などを簡単に記録できるWebサービス
- 記録を時系列で振り返り、体調や生活の変化を把握できるようにする
- 記念日や定期的なケアのタイミングを通知する
- 個人・家庭内で使う前提のサービス
- 名前の由来: CAT + KANSHI（監視） = CANSHI（キャンシ）

## 開発方針

### MVP

- 猫の基本情報
- ごはんの登録・摂取量計算
- うんち、体重、嘔吐の記録
- 症状、服薬、通院の記録
- すべての記録を時系列で表示
- Cloudflare Accessによるアクセス制限

### 第2段階

- 写真・動画のアップロード
- 水分量の記録
- 掃除・シャンプー管理
- PWA対応
- Web Push通知

### 第3段階

- AIによる画像の補助分類
- 猫ごとのAI参照用プロフィール・履歴
- 複数猫対応と猫ごとの比較

DBは最初からすべての記録にcat_idを持たせ、将来の複数猫対応に備える。

## 機能一覧

### 記録

- 基本情報
  - 名前
  - 性別
  - 生年月日
    - 年齢を表示
  - 猫種
  - お迎え日
    - お迎えからの日数を表示
- ごはん
  - ごはんの商品を登録
    - 商品名
    - 画像
    - 100gあたりのカロリー（kcal/100g）
    - 1袋・1缶あたりの内容量
    - 総合栄養食または一般食
    - ドライまたはウェット
  - ワンタップで、どのごはんを何グラム与えたか記録
  - 与えた量と残した量を分けて記録
  - 推定摂取量と推定摂取カロリーを計算
    - 推定摂取量 = 与えた量 - 残した量
    - 推定摂取カロリー = 推定摂取量 × kcal/100g ÷ 100
- 水
  - 測定方法、給水量、残量を記録
  - こぼれや水交換の有無を記録
  - 給水量と残量から推定飲水量を計算
  - 主観評価として多い、いつも通り、少ないを設定
- うんち
  - 発生日時、回数、量、色を記録
  - 状態を記録（硬い、ふつう、柔らかい、液体）
  - 血液や異物の有無、備考、食欲・元気を記録
  - 写真を記録
  - AIが画像から確認できる特徴を補助的に分類
- シャンプー
  - 実施日を記録
- 体重
  - 人間を含んだ体重と人間だけの体重を入力し、愛猫の体重を自動算出
  - 猫の体重を直接入力することも可能
- 嘔吐
  - 発生日時、回数、量、色を記録
  - 血液や異物の有無、備考、食欲・元気を記録
  - 写真を記録
  - AIが画像と付随情報から確認できる特徴を補助的に分類
- 症状
  - 症状の種類、発症日時、回数・程度を記録
  - 写真・動画を記録
  - 食欲・元気への影響を記録
  - 継続中、改善、解消などの状態を記録
  - 関連する通院記録を紐付け
- 服薬
  - 薬名、1回量、1日あたりの回数を記録
  - 服用開始日、終了予定日を記録
  - 実際に投薬した日時と投薬できたかを記録
  - 処方箋や薬袋の写真を記録
  - 関連する症状・通院記録を紐付け
- 通院
  - 予約日時、受診日時、受診理由を記録
  - 診断・所見、検査と結果、注射・処置を記録
  - 処方された薬を服薬記録に紐付け
  - 次回受診予定を記録
  - 診療明細などの画像を記録
  - 関連する症状を紐付け
- 掃除
  - 掃除するものの名前と頻度を設定
  - 実施日を記録
- 愛猫の体
  - 写真を記録
  - 写真からサムネイルを自動更新
  - AIが画像から確認できる特徴を補助的に分類

### タイムライン

- ごはん、排便、体重、嘔吐、症状、服薬、通院などを発生日時順に表示
- 記録の種類で絞り込み
- 各記録から関連する症状、服薬、通院を参照

### 通知

- 誕生日・月齢・年齢の節目
  - 年ごと
  - 半年ごと
  - 100日ごと
- 前回のシャンプーから指定した月数が経過
- 体重測定の提案
- 次の掃除タイミング
  - 猫砂
  - おしっこシート
- 通知時刻とタイムゾーンを設定
- 通知済み判定による重複防止
- 通知の完了、延期、無視
- 通知ごとの有効・無効
- Web Pushを利用できない場合は通知センターへ表示

### その他

- 複数猫対応
- 通知センター
- 猫ごとのAI参照用プロフィール・履歴を保持

## AIの利用方針

- AIは画像から確認できる特徴の補助的な分類に使用し、診断は行わない
- 食欲、元気、回数、継続時間、血液の有無などの付随情報も入力に使用
- 判定不能または信頼度が低い場合は評価を断定せず、動物病院への相談を案内
- AIの評価は利用者が修正可能
- 以下の情報を評価ごとに保存
  - 使用モデル
  - プロンプトのバージョン
  - AI出力
  - 判定日時
  - 利用者による修正結果
  - 入力した画像・動画のID

## データと画像の保存

- Cloudflare D1
  - 猫の基本情報
  - 各種記録と発生日時
  - 画像・動画のオブジェクトキー
  - AI評価結果
- Cloudflare R2
  - 写真・動画の本体
  - 元データとサムネイル
- Cloudflare Workers
  - Cloudflare Accessによるアクセス確認後に画像・動画を配信
- R2バケットは非公開
- アップロード時にEXIFを削除
- 記録の削除時に関連する画像・動画も削除
- 画像・動画のサイズと保存容量に上限を設定

## 認証・認可

- 認証・外部アクセス制御：Cloudflare Access
- アプリ内ユーザー管理：実装しない
- アプリ内認可：実装しない
- Cloudflare Accessで許可された利用者は、すべての猫と記録を共同で閲覧・編集可能
- 独自のログイン機能は実装しない

## 技術的仕様

- DB：Cloudflare D1
- オブジェクトストレージ：Cloudflare R2
- Web：Next.js
- Cloudflareアダプター：OpenNext（@opennextjs/cloudflare）
  - next buildの出力をCloudflare Workers向けに変換
  - nodejs_compatを有効化
  - 通常はnext devで開発し、定期的にWorkers環境でもプレビュー
  - ISR・SSGのキャッシュを使用する場合は、メディア用とは別のR2バケットを使用
- PWA：対応（第2段階）
- デプロイ：Cloudflare Workers
- 認証・外部アクセス制御：Cloudflare Access
- アプリ内ユーザー管理・認可：なし
- 通知：Web Push（第2段階）
- 単体・結合テスト：Vitest
- E2Eテスト：記録入力、画像アップロード、通知設定を対象に導入
- Linter／Formatter：Biome
- スタイル：CSS Modules + PostCSS
- UIライブラリ：なし
- アイコン：Tabler Icons（react-icons）
- AI：OpenAI API（gpt-5.6-terra）
- バックグラウンド処理：Cloudflare Workflows
  - 定期通知はWorkflowのスケジュールで起動

## デザインにおける考慮事項

## 技術参考資料

- [OpenNext adapter for Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [OpenNext for Cloudflare](https://opennext.js.org/cloudflare)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Cloudflare Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)
- [Cloudflare Workflows schedules](https://developers.cloudflare.com/workflows/build/trigger-workflows/)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Web Push for iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
