import type { Metadata } from "next";
import { Table } from "@/components/ui";
import {
  FEEDING_MODE_LABEL,
  GIVEN_AMOUNT_LEVEL_LABEL,
  LEFTOVER_LEVEL_LABEL,
} from "@/features/feeding-records/domain/labels";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpScreenshot } from "@/features/help/HelpScreenshot";
import { getHelpTopic } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

const SLUG = "feeding-modes";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

const givenAmountLevels = Object.values(GIVEN_AMOUNT_LEVEL_LABEL).join("・");
const leftoverLevels = Object.values(LEFTOVER_LEVEL_LABEL).join("・");

export default function FeedingModesHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <p>
          ごはん記録とごはんプリセットでは、量の記録方法を「
          {FEEDING_MODE_LABEL.strict}」と「{FEEDING_MODE_LABEL.approximate}
          」から選べます。量をきちんと量れる日は厳格モード、量れない日や手早く記録したい日はあいまいモード、というように記録ごとに使い分けられます。
        </p>
      }
      related={["records/feeding-records", "feeding-presets"]}
    >
      <Surface title="違いの早見表" titleId="feeding-modes-comparison" gap="md">
        <Table aria-labelledby="feeding-modes-comparison">
          <thead>
            <tr>
              <td />
              <th scope="col">{FEEDING_MODE_LABEL.strict}</th>
              <th scope="col">{FEEDING_MODE_LABEL.approximate}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">与えた量</th>
              <td>グラムで入力</td>
              <td>{givenAmountLevels}から選ぶ</td>
            </tr>
            <tr>
              <th scope="row">残した量</th>
              <td>グラムで入力</td>
              <td>{leftoverLevels}から選ぶ</td>
            </tr>
            <tr>
              <th scope="row">食べた量・カロリー</th>
              <td>計算してグラフに表示</td>
              <td>計算しない</td>
            </tr>
            <tr>
              <th scope="row">向いている場面</th>
              <td>量をきちんと量れるとき</td>
              <td>量れないとき・手早く記録したいとき</td>
            </tr>
          </tbody>
        </Table>
      </Surface>

      <Surface title={FEEDING_MODE_LABEL.strict} gap="md">
        <ul className={styles.points}>
          <li>与えた量・残した量をグラム単位で記録します。</li>
          <li>
            登録した商品のカロリーから、食べた量とカロリーを計算して記録します。
          </li>
          <li>ごはん記録のグラフに食べた量・カロリーの推移が表示されます。</li>
        </ul>
      </Surface>

      <Surface title={FEEDING_MODE_LABEL.approximate} gap="md">
        <ul className={styles.points}>
          <li>与えた量を「{givenAmountLevels}」の3段階で記録します。</li>
          <li>残した量を「{leftoverLevels}」の3段階で記録します。</li>
          <li>
            正確な量がわからないため、食べた量・カロリーは計算せず、ごはん記録のグラフにも表示されません。
          </li>
        </ul>
      </Surface>

      <div className={styles.screenshotRow}>
        <HelpScreenshot
          name="feeding-mode-strict"
          alt={`ごはんを記録する画面で「${FEEDING_MODE_LABEL.strict}」を選び、与えた量・残した量をグラムで入力している`}
          caption={FEEDING_MODE_LABEL.strict}
        />
        <HelpScreenshot
          name="feeding-mode-approximate"
          alt={`ごはんを記録する画面で「${FEEDING_MODE_LABEL.approximate}」を選び、与えた量・残した量を段階で選んでいる`}
          caption={FEEDING_MODE_LABEL.approximate}
        />
      </div>

      <Surface title="選び方のポイント" gap="md">
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
    </HelpArticle>
  );
}
