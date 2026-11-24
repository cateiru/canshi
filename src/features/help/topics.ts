import {
  AddToHomeScreenIcon,
  AiConnectionIcon,
  ApiTokenIcon,
  AppearanceSettingsIcon,
  CatFaceIcon,
  FeedingIcon,
  FeedingPresetIcon,
  FoodProductIcon,
  HouseholdIcon,
  NotificationSettingsIcon,
  RecordExportIcon,
  ReleaseNotesIcon,
} from "@canshi/shared/ui/RecordIcons";
import type { IconType } from "react-icons";
import { RECORD_HELPS } from "./recordHelps";

/** ヘルプの記事 1 件。`/help/<slug>` で表示する */
export type HelpTopic = {
  /** `/help/` より後ろのパス（例: `create-household`・`records/poop-records`） */
  slug: string;
  title: string;
  /** ヘルプ一覧に出す、記事の内容の一言説明 */
  description: string;
  icon: IconType;
};

/** ヘルプ一覧（`/help`）で記事をまとめる見出し */
export type HelpCategory = {
  id: string;
  title: string;
  topics: HelpTopic[];
};

export const HELP_INDEX_HREF = "/help";

/** ヘルプの記事の URL */
export function helpHref(slug: string) {
  return `${HELP_INDEX_HREF}/${slug}`;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "getting-started",
    title: "はじめに",
    topics: [
      {
        slug: "households-and-cats",
        title: "「家」と「ねこ」とは？",
        description:
          "記録を家族で共有するしくみと、家・ねこ・記録の関係を説明します。",
        icon: HouseholdIcon,
      },
      {
        slug: "create-household",
        title: "家の作り方・家族の招待",
        description: "家を作成し、招待 URL で家族をメンバーに加える方法です。",
        icon: HouseholdIcon,
      },
      {
        slug: "add-cat",
        title: "ねこの登録方法",
        description:
          "ねこを家に登録し、プロフィールや大切な日を設定する方法です。",
        icon: CatFaceIcon,
      },
      {
        slug: "add-to-home-screen",
        title: "ホーム画面に追加する方法",
        description:
          "CANSHI をスマートフォンのホーム画面に追加して、アプリのように使う方法です。",
        icon: AddToHomeScreenIcon,
      },
    ],
  },
  {
    id: "food",
    title: "ごはんの設定",
    topics: [
      {
        slug: "household-food",
        title: "家のごはんの設定方法",
        description:
          "ごはん商品・ごはんの時間・ごはんプリセットを家に登録する方法です。",
        icon: FoodProductIcon,
      },
      {
        slug: "feeding-presets",
        title: "「ごはんプリセット」とは？",
        description:
          "よくあげるごはんの組み合わせを登録して、記録を手早くする機能です。",
        icon: FeedingPresetIcon,
      },
      {
        slug: "feeding-modes",
        title: "「厳格モード」「あいまいモード」とは？",
        description: "ごはんの量の記録方法の違いと、選び方を説明します。",
        icon: FeedingIcon,
      },
    ],
  },
  {
    id: "records",
    title: "記録",
    topics: [
      {
        slug: "records",
        title: "記録のつけ方",
        description:
          "記録の追加・編集・見返し方と、タイムラインについて説明します。",
        icon: ReleaseNotesIcon,
      },
      ...RECORD_HELPS.map((record) => ({
        slug: recordHelpSlug(record.recordType),
        title: record.title,
        description: record.summary,
        icon: record.icon,
      })),
      {
        slug: "record-exports",
        title: "記録の出力（CSV）",
        description:
          "家の記録を CSV ファイルに書き出し、zip ファイルでダウンロードする方法です。",
        icon: RecordExportIcon,
      },
    ],
  },
  {
    id: "settings",
    title: "設定",
    topics: [
      {
        slug: "notifications",
        title: "通知の設定",
        description:
          "ごはんの時間や記念日、お手入れのお知らせを受け取る方法です。",
        icon: NotificationSettingsIcon,
      },
      {
        slug: "appearance",
        title: "見た目の設定",
        description:
          "画面の明るさ・アクセントカラー・見やすさ・文字の大きさを変える方法です。ログイン前でも変えられます。",
        icon: AppearanceSettingsIcon,
      },
      {
        slug: "ai-connections",
        title: "AIとの接続方法",
        description:
          "ChatGPT などの AI のアプリから、ねこの記録を見たり記録したりする方法です。",
        icon: AiConnectionIcon,
      },
      {
        slug: "api",
        title: "APIの使い方",
        description:
          "自分で作ったプログラムなどから、ねこの記録を読んだり追加したりする方法です。",
        icon: ApiTokenIcon,
      },
    ],
  },
];

/** 記録ごとのヘルプの slug（`records/<記録の種類>`） */
export function recordHelpSlug(recordType: string) {
  return `records/${recordType}`;
}

/** slug からヘルプの記事を探す。見つからなければ例外にする（記事のページは定義済みの slug だけを使う） */
export function getHelpTopic(slug: string): HelpTopic {
  for (const category of HELP_CATEGORIES) {
    const topic = category.topics.find((item) => item.slug === slug);
    if (topic) {
      return topic;
    }
  }
  throw new Error(`ヘルプの記事が見つかりません: ${slug}`);
}
