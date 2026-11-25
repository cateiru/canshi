import {
  BroomIcon,
  BrushingIcon,
  ExpenseIcon,
  FeedingIcon,
  HospitalIcon,
  MedicationIcon,
  MemoIcon,
  PoopIcon,
  ShampooIcon,
  SymptomIcon,
  VomitIcon,
  WaterIcon,
  WeightIcon,
} from "@canshi/shared/ui/RecordIcons";
import type { IconType } from "react-icons";
import type { HelpScreenshotName } from "./screenshots";

/** 記録の項目 1 つの説明 */
export type RecordHelpField = {
  label: string;
  description: string;
};

/**
 * 記録の種類ごとのヘルプ（`/help/records/<recordType>`）の中身。
 * 記録の種類は、ねこの詳細ページの記録の導線（`src/features/cats/presentation/recordNav.ts`）と
 * 同じ順・同じ名前にする
 */
export type RecordHelp = {
  /** ねこの記録のページのパス（`/cats/<catId>/<recordType>`）と同じ文字列 */
  recordType: string;
  title: string;
  icon: IconType;
  /** ヘルプ一覧と記事の冒頭に出す一言説明 */
  summary: string;
  /** 記事の冒頭の説明。summary より詳しく書く */
  lead: string;
  fields: RecordHelpField[];
  tips: string[];
  /** 記録の画面のスクリーンショット（`public/images/help/<name>.webp`） */
  screenshot: { name: HelpScreenshotName; alt: string; caption: string };
  /** あわせて読むとよいヘルプの slug */
  related?: string[];
};

export const RECORD_HELPS: RecordHelp[] = [
  {
    recordType: "feeding-records",
    title: "ごはん記録",
    icon: FeedingIcon,
    summary: "あげたごはんの商品と量、残した量を記録します。",
    lead: "あげたごはんの商品と量、残した量を記録します。量をグラム（スープ・ミルクなど ml の商品は ml）で記録すると、食べた量とカロリーを計算してグラフで確認できます。",
    fields: [
      {
        label: "日付・時刻",
        description: "ごはんをあげた日時です。最初は今の日時が入っています。",
      },
      {
        label: "プリセット",
        description:
          "家に登録したごはんプリセットを選ぶと、商品と与えた量がまとめて入力されます。",
      },
      {
        label: "記録方法",
        description:
          "量をグラム（ml の商品は ml）で記録する「厳格モード」と、3段階で記録する「あいまいモード」から選びます。",
      },
      {
        label: "商品・与えた量・残した量",
        description:
          "家に登録したごはん商品から選びます。複数の商品を1回の記録にまとめられます。量は商品の単位（g・ml）で入力します。",
      },
      { label: "備考", description: "気づいたことを自由に書けます。" },
    ],
    tips: [
      "記録する前に、家の設定で「ごはん商品」を登録しておく必要があります。",
      "量の単位を ml にした商品（スープ・ミルクなど）の量は、g の商品の「食べた量」と分けて「飲んだ量」として表示します。",
      "家の「ごはんの時間」を登録しておくと、記録がないときに確認のお知らせが届きます。どれかのねこのごはんを記録すると、そのお知らせは完了になります。",
    ],
    screenshot: {
      name: "record-feeding",
      alt: "ごはんを記録する画面。プリセット・記録方法・商品と与えた量の入力欄が並んでいる",
      caption: "ごはんを記録する画面",
    },
    related: ["household-food", "feeding-presets", "feeding-modes"],
  },
  {
    recordType: "poop-records",
    title: "うんち記録",
    icon: PoopIcon,
    summary: "うんちの状態・量・色を記録します。",
    lead: "うんちの状態・量・色を記録します。体調の変化に早く気づけるよう、写真やそのときの様子も残せます。",
    fields: [
      { label: "記録日・記録時刻", description: "うんちをした日時です。" },
      {
        label: "状態",
        description: "「硬い」「ふつう」「柔らかい」「液体」から選びます。",
      },
      {
        label: "量・色",
        description: "「少なめ」「ふつう」など、見た目の量と色を書きます。",
      },
      {
        label: "血液が混じっていた",
        description: "血液が混じっていたときにチェックを入れます。",
      },
      {
        label: "写真",
        description: "動物病院で見せたいときなどのために、写真を残せます。",
      },
      {
        label: "食欲メモ・元気メモ・備考",
        description: "そのときの食欲や元気の様子などを自由に書けます。",
      },
    ],
    tips: [
      "一覧のグラフで、状態の移り変わりを確認できます。",
      "写真は位置情報などのメタデータを取り除いて保存します。",
    ],
    screenshot: {
      name: "record-poop",
      alt: "うんちを記録する画面。記録日時・状態・量・色の入力欄が並んでいる",
      caption: "うんちを記録する画面",
    },
  },
  {
    recordType: "weight-records",
    title: "体重記録",
    icon: WeightIcon,
    summary: "体重と体型（BCS）を記録します。",
    lead: "体重と体型（ボディコンディションスコア、BCS）を記録します。ねこを抱っこして体重計に乗る方法でも記録できます。",
    fields: [
      { label: "記録日・記録時刻", description: "体重を量った日時です。" },
      {
        label: "入力方法",
        description:
          "「人間込みの体重から自動算出」では、ねこを抱っこして量った体重と人間だけの体重を入力すると、差をねこの体重として記録します。「ねこの体重を直接入力」では、ねこの体重をそのまま入力します。",
      },
      {
        label: "BCS",
        description:
          "体型を「痩せ」から「肥満」までの5段階で記録します。イラストと説明を見ながら選べます。",
      },
      { label: "備考", description: "気づいたことを自由に書けます。" },
    ],
    tips: [
      "一覧のグラフで、体重の推移を確認できます。",
      "通知の設定で、最後に量ってから決まった日数が経つと体重測定をおすすめするお知らせを受け取れます。",
    ],
    screenshot: {
      name: "record-weight",
      alt: "体重を記録する画面。入力方法の選択と体重の入力欄が並んでいる",
      caption: "体重を記録する画面",
    },
    related: ["notifications"],
  },
  {
    recordType: "vomit-records",
    title: "嘔吐記録",
    icon: VomitIcon,
    summary: "吐いたものの量・色を記録します。",
    lead: "吐いたものの量・色を記録します。回数や間隔を見返せるので、動物病院で相談するときに役立ちます。",
    fields: [
      { label: "記録日・記録時刻", description: "吐いた日時です。" },
      {
        label: "量・色",
        description: "「少なめ」「ふつう」など、吐いたものの量と色を書きます。",
      },
      {
        label: "血液・異物が混じっていた",
        description: "血液や異物が混じっていたときにチェックを入れます。",
      },
      { label: "写真", description: "吐いたものの写真を残せます。" },
      {
        label: "食欲メモ・元気メモ・備考",
        description: "そのときの食欲や元気の様子などを自由に書けます。",
      },
    ],
    tips: [
      "続くときや元気がないときは、症状記録にもまとめておくと経過を追いやすくなります。",
    ],
    screenshot: {
      name: "record-vomit",
      alt: "嘔吐を記録する画面。記録日時・量・色の入力欄が並んでいる",
      caption: "嘔吐を記録する画面",
    },
    related: ["records/symptoms"],
  },
  {
    recordType: "water-records",
    title: "水の記録",
    icon: WaterIcon,
    summary: "お水の量を記録し、飲んだ量を確認します。",
    lead: "あげたお水の量と残った量を記録します。差から飲んだ量（推定飲水量）を計算します。",
    fields: [
      { label: "記録日・記録時刻", description: "量った日時です。" },
      {
        label: "測定方法",
        description: "「計量カップ」「秤」「目視」から選びます。",
      },
      {
        label: "給水量・残量（ml）",
        description:
          "あげたお水の量と、残っていたお水の量です。残量を入力すると、差を推定飲水量として記録します。",
      },
      {
        label: "主観評価",
        description:
          "量れないときは、「多い」「いつも通り」「少ない」で記録できます。",
      },
      { label: "備考", description: "気づいたことを自由に書けます。" },
    ],
    tips: [
      "同じ量のお水を量ってあげて、残った量を量る習慣にすると、飲んだ量の変化に気づきやすくなります。",
    ],
    screenshot: {
      name: "record-water",
      alt: "水の記録の画面。測定方法・給水量・残量の入力欄が並んでいる",
      caption: "水の記録の画面",
    },
  },
  {
    recordType: "shampoo-records",
    title: "シャンプー記録",
    icon: ShampooIcon,
    summary: "シャンプーをした日を記録します。",
    lead: "シャンプーをした日を記録します。一覧で、前回のシャンプーから何日経ったかがひと目でわかります。",
    fields: [
      { label: "実施日・実施時刻", description: "シャンプーをした日時です。" },
      {
        label: "備考",
        description: "使ったシャンプーや様子などを自由に書けます。",
      },
    ],
    tips: [
      "通知の設定で、前回のシャンプーから決まった月数が経つとお知らせを受け取れます。",
    ],
    screenshot: {
      name: "record-shampoo",
      alt: "シャンプーを記録する画面。実施日時と備考の入力欄が並んでいる",
      caption: "シャンプーを記録する画面",
    },
    related: ["notifications"],
  },
  {
    recordType: "brushing-records",
    title: "ブラッシング記録",
    icon: BrushingIcon,
    summary: "ブラッシングの時間と抜け毛の量を記録します。",
    lead: "ブラッシングをした日と時間、抜け毛の量を記録します。換毛期の変化も見返せます。",
    fields: [
      {
        label: "実施日・実施時刻",
        description: "ブラッシングをした日時です。",
      },
      { label: "時間（分）", description: "ブラッシングをした時間です。" },
      {
        label: "抜け毛の量",
        description: "「少ない」「いつも通り」「多い」から選びます。",
      },
      { label: "備考", description: "気づいたことを自由に書けます。" },
    ],
    tips: [],
    screenshot: {
      name: "record-brushing",
      alt: "ブラッシングを記録する画面。実施日時・時間・抜け毛の量の入力欄が並んでいる",
      caption: "ブラッシングを記録する画面",
    },
  },
  {
    recordType: "cleaning",
    title: "掃除記録",
    icon: BroomIcon,
    summary: "トイレや食器などの掃除を、対象ごとに記録します。",
    lead: "トイレの砂の交換や食器洗いなど、掃除する「対象」を登録し、対象ごとに掃除した日を記録します。決めた頻度から次の予定日を計算します。",
    fields: [
      {
        label: "対象の名前・頻度",
        description:
          "「トイレの砂の全交換を1ヶ月ごと」のように、掃除する対象と頻度を登録します。よく使う対象はワンタップで追加できます。",
      },
      {
        label: "通知時刻",
        description:
          "予定日のその時刻にお知らせします。指定しないときは、ほかのお知らせと同じ18:00に届きます。",
      },
      {
        label: "掃除の記録（実施日・実施時刻・備考）",
        description: "対象ごとに、掃除をした日時を記録します。",
      },
    ],
    tips: [
      "対象を無効にすると、予定日の計算とお知らせを止められます。",
      "対象ごとのお知らせは、ねこの通知設定で切り替えられます。",
    ],
    screenshot: {
      name: "record-cleaning",
      alt: "掃除の対象を追加する画面。よく使う対象のボタンと、対象を作成するフォームが並んでいる",
      caption: "掃除の対象を追加する画面",
    },
    related: ["notifications"],
  },
  {
    recordType: "symptoms",
    title: "症状記録",
    icon: SymptomIcon,
    summary: "気になる症状と、その経過を記録します。",
    lead: "下痢や元気がないなど、気になる症状と、その経過を記録します。通院記録や服薬記録と関連付けられます。",
    fields: [
      {
        label: "症状の種類",
        description: "「嘔吐」「下痢」「元気消失」など、症状を自由に書きます。",
      },
      { label: "発症日・発症時刻", description: "症状に気づいた日時です。" },
      {
        label: "状態",
        description:
          "「継続中」「改善」「解消」から選びます。経過に合わせて更新しましょう。",
      },
      { label: "回数・程度", description: "症状の回数や程度を書きます。" },
      {
        label: "写真・動画",
        description: "症状の様子を写真や動画で残せます。",
      },
      {
        label: "関連する通院記録",
        description: "症状で動物病院に行ったときの通院記録を選べます。",
      },
      {
        label: "食欲メモ・元気メモ・備考",
        description: "そのときの食欲や元気の様子などを自由に書けます。",
      },
    ],
    tips: [
      "通知の設定で、1ヶ月以上「解消」になっていない症状を確認するお知らせを受け取れます。",
    ],
    screenshot: {
      name: "record-symptoms",
      alt: "症状を記録する画面。症状の種類・発症日時・状態の入力欄が並んでいる",
      caption: "症状を記録する画面",
    },
    related: ["records/hospital-visits", "records/medications"],
  },
  {
    recordType: "medications",
    title: "服薬記録",
    icon: MedicationIcon,
    summary: "お薬の予定を登録し、飲ませた記録をつけます。",
    lead: "処方されたお薬を「服薬予定」として登録し、飲ませるたびに投薬の記録をつけます。終了予定日を過ぎたお薬は服薬歴に移ります。",
    fields: [
      {
        label: "薬名・1回量・1日あたりの回数",
        description: "処方されたお薬の名前と飲ませ方です。",
      },
      {
        label: "服用開始日・終了予定日",
        description: "お薬を飲ませる期間です。",
      },
      {
        label: "関連する症状・処方元の通院記録",
        description: "どの症状で、どの通院のときに処方されたお薬かを選べます。",
      },
      {
        label: "処方箋・薬袋の写真",
        description: "処方箋や薬袋の写真を残せます。",
      },
      {
        label: "投薬の記録（投薬日・投薬時刻・備考）",
        description: "服薬予定ごとに、お薬を飲ませた日時を記録します。",
      },
    ],
    tips: [],
    screenshot: {
      name: "record-medications",
      alt: "服薬予定を登録する画面。薬名・1回量・1日あたりの回数の入力欄が並んでいる",
      caption: "服薬予定を登録する画面",
    },
    related: ["records/symptoms", "records/hospital-visits"],
  },
  {
    recordType: "hospital-visits",
    title: "通院記録",
    icon: HospitalIcon,
    summary: "動物病院での診察内容と病院代を記録します。",
    lead: "動物病院に行った日の受診理由・診断・検査結果・処置などを記録します。次回の受診予定も残せます。",
    fields: [
      { label: "受診日・受診時刻", description: "動物病院に行った日時です。" },
      { label: "受診理由", description: "受診した理由です。" },
      {
        label: "病院代（円）",
        description:
          "入力すると、カテゴリ「病院」の支出記録としても保存されます。",
      },
      {
        label: "関連する症状",
        description: "受診のきっかけになった症状記録を選べます。",
      },
      {
        label: "診断・所見／検査と結果／注射・処置",
        description: "獣医さんから聞いた内容を残せます。",
      },
      {
        label: "次回受診予定日・時刻",
        description: "次に受診する予定の日時です。",
      },
      {
        label: "診療明細などの写真・備考",
        description: "診療明細や検査結果の写真などを残せます。",
      },
    ],
    tips: [
      "一覧のカレンダーで、これまでに通院した日を確認できます。",
      "病院代を空欄のまま記録すると、同じ日の「病院」の支出記録と紐付けるかを確認します。",
    ],
    screenshot: {
      name: "record-hospital-visits",
      alt: "通院を記録する画面。受診日時・受診理由・病院代の入力欄が並んでいる",
      caption: "通院を記録する画面",
    },
    related: ["records/expenses", "records/symptoms"],
  },
  {
    recordType: "expenses",
    title: "支出記録",
    icon: ExpenseIcon,
    summary: "ごはん代や病院代など、ねこにかかったお金を記録します。",
    lead: "ごはん代や病院代など、ねこにかかったお金を記録します。支出は家ごとに記録し、月ごとの合計とカテゴリごとの内訳を確認できます。",
    fields: [
      { label: "支出日", description: "お金を払った日です。" },
      { label: "金額（円）", description: "払った金額です。" },
      {
        label: "カテゴリ",
        description:
          "「ご飯」「おやつ」「衛生用品」「おもちゃ」「薬」「病院」「その他」から選びます。",
      },
      {
        label: "関連するねこ",
        description:
          "複数選べます。選んだねこのタイムラインに表示され、どのねこも選ばない場合は家の共通の支出になります。",
      },
      {
        label: "レシートなどの写真・メモ",
        description: "レシートの写真や、買ったもののメモを残せます。",
      },
    ],
    tips: [
      "支出は家に属するため、同じ家のメンバー全員で同じ支出を見られます。",
      "一覧では、表示しているねこに関連する支出だけに絞り込めます。",
    ],
    screenshot: {
      name: "record-expenses",
      alt: "支出を記録する画面。支出日・金額・カテゴリの入力欄が並んでいる",
      caption: "支出を記録する画面",
    },
    related: ["records/hospital-visits"],
  },
  {
    recordType: "memo-records",
    title: "メモ",
    icon: MemoIcon,
    summary: "ほかの記録に当てはまらないことを、自由にメモします。",
    lead: "ほかの記録に当てはまらないできごとや、覚えておきたいことを自由に書いて残します。",
    fields: [
      { label: "メモ", description: "残しておきたいことを自由に書きます。" },
      {
        label: "ラベル",
        description:
          "メモを分類するラベルを付けられます。好きな言葉を入力して Enter を押すか、候補から選ぶと追加でき、× を押すと外せます。1つのメモに複数のラベルを付けられます。",
      },
      { label: "画像", description: "写真などの画像を添えられます。" },
      {
        label: "日付を残す",
        description:
          "チェックを入れると日付と時刻を残し、タイムラインにも表示します。日付を残さないメモは、タイムラインには表示されません。",
      },
    ],
    tips: [
      "かかりつけの病院の連絡先など、日付に関係ないことは日付を残さずにメモしておくと便利です。",
      "メモの一覧では、ラベルを選ぶと、そのラベルが付いたメモだけを表示できます。",
      "ラベルは家ごとに作り、同じ家のすべてのねこのメモで使えます。名前の変更と削除は、メモの一覧の「ラベルの管理」からできます。メモに付いているラベルは削除できません。",
    ],
    screenshot: {
      name: "record-memo",
      alt: "メモを追加する画面。メモ・ラベル・画像・日付の入力欄が並んでいる",
      caption: "メモを追加する画面",
    },
  },
];

/** 記録の種類からヘルプを探す。見つからなければ undefined */
export function findRecordHelp(recordType: string): RecordHelp | undefined {
  return RECORD_HELPS.find((record) => record.recordType === recordType);
}
