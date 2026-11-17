import type { Metadata } from "next";
import Link from "next/link";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpShortcuts } from "@/features/help/HelpShortcuts";
import { HelpSteps } from "@/features/help/HelpSteps";
import { getHelpTopic, helpHref } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

const SLUG = "household-food";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default function HouseholdFoodHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <>
          <p>
            ごはんの記録に使う商品や、ごはんの時間は、家ごとに登録して家のメンバー全員で使います。設定の「家の設定」から家を選び、「ごはん」の項目から登録します。
          </p>
          <p>
            ごはんを記録するには、少なくとも1つのごはん商品が必要です。まずはいつもあげているごはんを登録しましょう。
          </p>
        </>
      }
      related={[
        "feeding-presets",
        "feeding-modes",
        "records/feeding-records",
        "notifications",
      ]}
    >
      <Surface title="ごはん商品を登録する" gap="md">
        <HelpSteps
          steps={[
            {
              title:
                "家の設定の「ごはん商品一覧」を開き、「商品を登録する」を押します",
              action: <HelpShortcuts target="food-products" />,
              body: (
                <p>
                  登録の方法を「共通のごはん商品から探す」か「手動で入力する」から選びます。
                </p>
              ),
              screenshot: {
                name: "food-product-add",
                alt: "ごはん商品の登録方法を選ぶ画面。「共通のごはん商品から探す」と「手動で入力する」が並んでいる",
              },
            },
            {
              title: "商品を選ぶか、商品の情報を入力して登録します",
              body: (
                <>
                  <p>
                    「共通のごはん商品から探す」では、商品名やメーカー名で検索し、画像付きの候補から選ぶだけで登録できます。
                  </p>
                  <p>
                    見つからないときは「手動で入力する」で、商品名・カロリー（100gあたり）・内容量などを入力します。カロリーは、ごはんを記録したときに食べたカロリーの計算に使います。
                  </p>
                </>
              ),
              screenshot: {
                name: "food-product-new",
                alt: "ごはん商品を手動で登録する画面。商品名・メーカー名・カロリーの入力欄が並んでいる",
              },
            },
          ]}
        />
      </Surface>

      <Surface title="ごはんの時間を登録する" gap="md">
        <HelpSteps
          steps={[
            {
              title: "家の設定の「ごはんの時間」を開き、時刻を選んで追加します",
              action: <HelpShortcuts target="feeding-schedules" />,
              body: (
                <>
                  <p>
                    登録した時間に、家のメンバーへ「ごはんの時間です」とお知らせします（日本時間）。
                  </p>
                  <p>
                    「記録がないときに確認の通知をする」にチェックを入れると、時間の前後にどのねこのごはんの記録もないときに、ごはんの時間の1時間後（次のごはんの時間との中間のほうが早ければ中間）に「ごはんはあげましたか？」と確認します。
                  </p>
                </>
              ),
              screenshot: {
                name: "feeding-schedules",
                alt: "ごはんの時間の画面。登録したごはんの時間と、時間を追加するフォームが並んでいる",
              },
            },
          ]}
        />
        <p>
          お知らせを受け取るには、端末の通知をオンにする必要があります。くわしくは
          <Link href={helpHref("notifications")} className={styles.inlineLink}>
            通知の設定
          </Link>
          を見てください。
        </p>
      </Surface>

      <Surface title="ごはんプリセットを登録する" gap="md">
        <p>
          よくあげるごはんの商品と量の組み合わせを、ごはんプリセットとして登録できます。家の設定の「ごはんプリセット一覧」から登録すると、ごはんを記録するときにプリセットを選ぶだけで、商品と量が入力されます。くわしくは
          <Link
            href={helpHref("feeding-presets")}
            className={styles.inlineLink}
          >
            「ごはんプリセット」とは？
          </Link>
          を見てください。
        </p>
      </Surface>
    </HelpArticle>
  );
}
