import type { Metadata } from "next";
import Link from "next/link";
import { TbList, TbPlus } from "react-icons/tb";
import { ButtonLink } from "@/components/ui";
import {
  FEEDING_MODE_HELP_HREF,
  FEEDING_MODE_LABEL,
  GIVEN_AMOUNT_LEVEL_LABEL,
  LEFTOVER_LEVEL_LABEL,
} from "@/features/feeding-records/domain/labels";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpScreenshot } from "@/features/help/HelpScreenshot";
import { getHelpTopic } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

const SLUG = "feeding-presets";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

type FeedingPresetsHelpPageProps = {
  // ごはん記録の画面から来たときは、その猫の家のプリセットの登録・一覧へ進めるようにする
  searchParams: Promise<{ householdId?: string | string[] }>;
};

export default async function FeedingPresetsHelpPage({
  searchParams,
}: FeedingPresetsHelpPageProps) {
  const { householdId } = await searchParams;
  // 家の ID はそのまま登録・一覧の画面へ渡し、所属しているかどうかはそちらで判断する
  const householdQuery =
    typeof householdId === "string"
      ? `?householdId=${encodeURIComponent(householdId)}`
      : "";

  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <p>
          ごはんプリセットは、よくあげるごはんの商品と量の組み合わせを登録しておく機能です。ごはんを記録するときにプリセットを選ぶだけで、商品と与えた量が入力されます。
        </p>
      }
      related={["household-food", "records/feeding-records", "feeding-modes"]}
    >
      <Surface title="記録するときの使い方" gap="md">
        <ul className={styles.points}>
          <li>
            ごはんを記録する画面の「プリセット」から使いたいプリセットを選ぶと、商品・与えた量・記録方法がプリセットの内容で入力されます。
          </li>
          <li>
            残した量は毎回変わるため、プリセットには登録しません。プリセットを選ぶと、残した量は「0g」（
            {FEEDING_MODE_LABEL.approximate}では「{LEFTOVER_LEVEL_LABEL.none}
            」）で入力されます。
          </li>
          <li>
            入力された内容は、記録する前に自由に変更できます。プリセットを選び直すと、入力中の商品はそのプリセットの内容に置き換わります。
          </li>
        </ul>
      </Surface>

      <Surface title="登録できる内容" gap="md">
        <ul className={styles.points}>
          <li>プリセット名（例: 朝ごはん、おやつ）</li>
          <li>
            商品と与えた量。複数の商品を組み合わせて1つのプリセットにできます。
          </li>
          <li>
            記録方法（「{FEEDING_MODE_LABEL.strict}」または「
            {FEEDING_MODE_LABEL.approximate}
            」）。あいまいモードでは、与えた量を「
            {Object.values(GIVEN_AMOUNT_LEVEL_LABEL).join("・")}
            」の段階で登録します。記録方法の違いは
            <Link href={FEEDING_MODE_HELP_HREF} className={styles.inlineLink}>
              「{FEEDING_MODE_LABEL.strict}」「{FEEDING_MODE_LABEL.approximate}
              」とは？
            </Link>
            で説明しています。
          </li>
          <li>
            プリセットは家ごとに登録し、同じ家のメンバー全員で使えます。設定の「家の設定」から家を選び、「ごはんプリセット一覧」で登録・編集・削除できます。
          </li>
        </ul>
        <HelpScreenshot
          name="feeding-preset-new"
          alt="ごはんプリセットを登録する画面。プリセット名・記録方法・商品と与えた量の入力欄が並んでいる"
          caption="ごはんプリセットを登録する画面"
        />
      </Surface>

      <div className={styles.actions}>
        <ButtonLink
          href={`/feeding-presets/new${householdQuery}`}
          variant="primary"
          leftIcon={TbPlus}
        >
          プリセットを登録する
        </ButtonLink>
        <ButtonLink
          href={`/feeding-presets${householdQuery}`}
          leftIcon={TbList}
        >
          プリセット一覧を見る
        </ButtonLink>
      </div>
    </HelpArticle>
  );
}
