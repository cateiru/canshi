import type { ComponentType } from "react";
import type { IconBaseProps } from "react-icons";
import {
  TbChartDots,
  TbComponents,
  TbConfetti,
  TbError404,
  TbIcons,
  TbNews,
  TbScale,
  TbUpload,
} from "react-icons/tb";

export type DevPage = {
  /** `src/app/dev/` の下のディレクトリ名。`/dev/<slug>` で開く */
  slug: string;
  title: string;
  description: string;
  icon: ComponentType<IconBaseProps>;
};

/**
 * 開発用ページ（`/dev/*`）の一覧。`/dev` のインデックスに表示する。
 * ページを追加したらここにも追加する（`devPages.test.ts` で、ディレクトリとの食い違いを確かめる）
 */
export const DEV_PAGES: readonly DevPage[] = [
  {
    slug: "components",
    title: "コンポーネントプレビュー",
    description:
      "ボタン・フォーム・モーダルなどの共通部品と、色・余白・文字の大きさのトークンを並べます。",
    icon: TbComponents,
  },
  {
    slug: "modals",
    title: "モーダル",
    description:
      "ウェルカムモーダルと誕生日のお祝いを、条件に関わらず何度でも開けます。",
    icon: TbConfetti,
  },
  {
    slug: "media",
    title: "メディアのアップロード",
    description:
      "記録に紐付けずに、R2 へのアップロード・配信・削除を試せます。",
    icon: TbUpload,
  },
  {
    slug: "release-notes",
    title: "更新情報（固定データ）",
    description:
      "更新情報のページを固定のダミーデータで表示します。VRT で撮るページです。",
    icon: TbNews,
  },
  {
    slug: "record-icons",
    title: "イラストアイコン",
    description:
      "イラストアイコンをすべて、猫の毛色ごとと単色表示で並べます。VRT で撮るページです。",
    icon: TbIcons,
  },
  {
    slug: "bcs-illustrations",
    title: "BCS のイラスト",
    description:
      "体重記録の BCS のイラストをすべて、猫の毛色ごとに並べます。VRT で撮るページです。",
    icon: TbScale,
  },
  {
    slug: "poop-chart",
    title: "うんちの時間帯のグラフ",
    description:
      "うんち記録のグラフを、固定の今日・記録で表示します。VRT で撮るページです。",
    icon: TbChartDots,
  },
  {
    slug: "error-page",
    title: "エラーページ",
    description:
      "予期しないエラーのときに出るページを、エラーを起こさずに表示します。VRT で撮るページです。",
    icon: TbError404,
  },
];
