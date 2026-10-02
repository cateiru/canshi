import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { FeedingIcon } from "@/components/ui/RecordIcons/RecordIcons";
import {
  FEEDING_MODE_LABEL,
  GIVEN_AMOUNT_LEVEL_LABEL,
  LEFTOVER_LEVEL_LABEL,
} from "@/features/feeding-records/labels";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

const PAGE_TITLE = "「厳格モード」「あいまいモード」とは？";

export const metadata: Metadata = {
  title: `${PAGE_TITLE} | CANSHI`,
};

const givenAmountLevels = Object.values(GIVEN_AMOUNT_LEVEL_LABEL).join("・");
const leftoverLevels = Object.values(LEFTOVER_LEVEL_LABEL).join("・");

export default function FeedingModesHelpPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/home" }, { label: PAGE_TITLE }]}
      />

      <RecordPageHeading icon={FeedingIcon}>{PAGE_TITLE}</RecordPageHeading>
      <p>
        ごはん記録とごはんプリセットでは、量の記録方法を「
        {FEEDING_MODE_LABEL.strict}」と「{FEEDING_MODE_LABEL.approximate}
        」から選べます。量をきちんと量れる日は厳格モード、量れない日や手早く記録したい日はあいまいモード、というように記録ごとに使い分けられます。
      </p>

      <Surface title={FEEDING_MODE_LABEL.strict} className={styles.section}>
        <ul className={styles.points}>
          <li>与えた量・残した量をグラム単位で記録します。</li>
          <li>
            登録した商品のカロリーから、食べた量とカロリーを計算して記録します。
          </li>
          <li>ごはん記録のグラフに食べた量・カロリーの推移が表示されます。</li>
        </ul>
      </Surface>

      <Surface
        title={FEEDING_MODE_LABEL.approximate}
        className={styles.section}
      >
        <ul className={styles.points}>
          <li>与えた量を「{givenAmountLevels}」の3段階で記録します。</li>
          <li>残した量を「{leftoverLevels}」の3段階で記録します。</li>
          <li>
            正確な量がわからないため、食べた量・カロリーは計算せず、ごはん記録のグラフにも表示されません。
          </li>
        </ul>
      </Surface>

      <Surface title="選び方のポイント" className={styles.section}>
        <ul className={styles.points}>
          <li>
            記録方法は1回のごはん記録ごとに選びます。複数の商品を与えた場合も、その記録のすべての商品に同じ記録方法が使われます（商品ごとに分けることはできません）。
          </li>
          <li>
            ごはんプリセットにも記録方法を設定できます。プリセットを選ぶと、記録フォームの記録方法もプリセットに合わせて切り替わります。
          </li>
          <li>
            どちらの記録方法で記録したごはんも、タイムラインや外部の AI
            エージェント（MCP）から確認できます。
          </li>
        </ul>
      </Surface>
    </main>
  );
}
