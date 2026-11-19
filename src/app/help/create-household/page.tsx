import type { Metadata } from "next";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpShortcuts } from "@/features/help/HelpShortcuts";
import { HelpSteps } from "@/features/help/HelpSteps";
import { getHelpTopic } from "@/features/help/topics";
import { HOUSEHOLD_INVITATION_MAX_AGE_SECONDS } from "@/features/households/domain/household";
import { Surface } from "@/features/shared/Surface";

const SLUG = "create-household";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

const invitationMaxAgeDays =
  HOUSEHOLD_INVITATION_MAX_AGE_SECONDS / (24 * 60 * 60);

export default function CreateHouseholdHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <p>
          ねこを登録するには、先に「家」が必要です。家を作ると、あなたがその家のオーナーになります。いっしょにお世話をする家族は、招待
          URL で家に招待できます。
        </p>
      }
      related={["households-and-cats", "add-cat", "household-food"]}
    >
      <Surface title="家を作成する" gap="md">
        <HelpSteps
          steps={[
            {
              title: "ねこ一覧の「家を作成する」を押します",
              action: <HelpShortcuts target="household-new" />,
              body: (
                <p>
                  まだ家がないときは、ねこ一覧に家の作成の案内が表示されます。家を持っているときは、ねこ一覧の「追加する」や、設定の「家の設定」からも作成できます。
                </p>
              ),
              screenshot: {
                name: "cats-empty",
                alt: "家がないときのねこ一覧。「家を作成する」ボタンが表示されている",
              },
            },
            {
              title: "家の名前を入力して「家を作成する」を押します",
              body: (
                <p>
                  「わが家」など、家族でわかる名前を付けてください。名前はあとから家の設定で変えられます。
                </p>
              ),
              screenshot: {
                name: "household-new",
                alt: "家を作成する画面。家の名前の入力欄と「家を作成する」ボタンがある",
              },
            },
          ]}
        />
      </Surface>

      <Surface title="家族を招待する" gap="md">
        <p>家族の招待は、家のオーナーが行います。</p>
        <HelpSteps
          steps={[
            {
              title: "設定の「家の設定」から、招待したい家を開きます",
              action: <HelpShortcuts target="household-invitation" />,
              body: (
                <p>
                  家の設定では、家の名前・メンバー・ごはんの設定・招待を管理できます。
                </p>
              ),
              screenshot: {
                name: "household-detail",
                alt: "家の設定の画面。家の名前・メンバー・ごはんの設定が並んでいる",
              },
            },
            {
              title: "「招待」の「招待 URL を発行する」を押します",
              body: (
                <>
                  <p>
                    表示された URL
                    を「コピーする」や「共有する」で家族に送ります。この画面を閉じると
                    URL は表示し直せないため、送ってから閉じてください。
                  </p>
                  <p>
                    1 つの URL で参加できるのは 1 人だけで、発行から
                    {invitationMaxAgeDays}
                    日で使えなくなります。複数の家族を招待するときは、人数分の
                    URL を発行してください。
                  </p>
                </>
              ),
              screenshot: {
                name: "household-invitation",
                alt: "招待 URL のダイアログ。URL と「コピーする」「共有する」ボタンが表示されている",
              },
            },
            {
              title: "招待された家族が URL を開き、「参加する」を押します",
              body: (
                <>
                  <p>
                    ログインしていないときは、ログインしてから招待の画面に戻ります。参加すると、その家のねこの記録を見たり書いたりできるようになります。
                  </p>
                  <p>
                    はじめてアカウントを作成したときに出る「招待URLはお持ちですか？」の画面で「もっている」を選び、招待
                    URL を貼り付けて「適用」を押しても、招待の画面を開けます。
                  </p>
                </>
              ),
            },
          ]}
        />
      </Surface>

      <Surface title="困ったときは" gap="md">
        <ul className={styles.points}>
          <li>
            URL
            がわからなくなったときや、送り先を間違えたときは、家の設定の「まだ使われていない招待」から招待を無効化して、発行し直してください。
          </li>
          <li>
            メンバーを家から外す・オーナーを交代するのは、家の設定の「メンバー」から行えます（オーナーのみ）。
          </li>
          <li>
            家を削除するには、先にその家のねこをすべて削除する必要があります。
          </li>
        </ul>
      </Surface>
    </HelpArticle>
  );
}
