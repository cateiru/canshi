import type { Metadata } from "next";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpSteps } from "@/features/help/HelpSteps";
import { getHelpTopic } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";
import { TourStartCard } from "@/features/tour/presentation/TourStartCard";

const SLUG = "first-guide";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default function FirstGuideHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <p>
          はじめてログインすると、画面の上に「はじめてガイド」が表示されます。家の作成から、ねこ・ごはん・ごはんの時間とプリセットの登録までを、順番にご案内します。
        </p>
      }
      related={["households-and-cats", "create-household", "household-food"]}
    >
      <Surface title="ガイドの進め方" gap="md">
        <HelpSteps
          steps={[
            {
              title: "家を作成します",
              body: (
                <>
                  <p>
                    「家の作成へ進む」を押すと、家の作成の画面が開きます。家を作成すると「次へ」のボタンが表示されます。
                  </p>
                  <p>
                    ねこやごはんは家ごとに登録するため、このステップだけは飛ばせません。招待された家に参加したときは、家の作成は済んでいる扱いになります。
                  </p>
                </>
              ),
              screenshot: {
                name: "tour-start",
                alt: "はじめてガイドのステップ 1。「家を作成しましょう」の案内と「家の作成へ進む」ボタンが表示されている",
              },
            },
            {
              title: "ねこを登録します",
              body: (
                <p>
                  ねこの登録の画面で、名前などを入力して登録します。あとから登録するときは「スキップする」を押してください。
                </p>
              ),
            },
            {
              title: "ごはんを登録します",
              body: (
                <p>
                  ふだんあげているごはんの商品を登録します。共通のごはん商品から探すか、手動で入力できます。このステップも飛ばせます。
                </p>
              ),
            },
            {
              title: "ごはんの時間・プリセットを登録します",
              body: (
                <>
                  <p>
                    「ごはんの時間」と「ごはんプリセット」のそれぞれの「設定する」から、登録の画面を開きます。登録すると、チェックが付いて項目名に線が引かれます。
                  </p>
                  <p>
                    どちらか一方だけでもかまいません。登録を終えたら「ガイドを完了する」を押してください。
                  </p>
                </>
              ),
              screenshot: {
                name: "tour-feeding",
                alt: "はじめてガイドのステップ 4。ごはんの時間にチェックが付き、ごはんプリセットの「設定する」ボタンが表示されている",
              },
            },
          ]}
        />
      </Surface>

      <Surface title="ガイドをやめる・再開する" gap="md">
        <ul className={styles.points}>
          <li>
            ガイドの右上の「×」を押すと、いつでもガイドをやめられます。登録した内容はそのまま残ります。
          </li>
          <li>
            ガイドの進み具合は、使っている端末ごとに保存します。別の端末では、続きは表示されません。
          </li>
        </ul>
        <HelpSteps
          steps={[
            {
              title: "ヘルプの「ガイドをはじめる」を押します",
              body: (
                <p>
                  ヘルプの一覧や、このページの下から、いつでもガイドをはじめ直せます。まだ登録していないステップから再開し、すべて登録済みのときは最初から案内します。
                </p>
              ),
              screenshot: {
                name: "tour-help",
                alt: "ヘルプの一覧。「はじめてガイド」の欄に「ガイドをはじめる」ボタンが表示されている",
              },
            },
          ]}
        />
      </Surface>

      {/* ログインしているときだけ、ここからガイドをはじめられる */}
      <TourStartCard />
    </HelpArticle>
  );
}
