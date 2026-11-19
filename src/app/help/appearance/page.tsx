import type { Metadata } from "next";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpShortcuts } from "@/features/help/HelpShortcuts";
import { HelpSteps } from "@/features/help/HelpSteps";
import { getHelpTopic } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

const SLUG = "appearance";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default function AppearanceHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <>
          <p>
            「見た目設定」では、画面の明るさやアクセントカラー、枠線・文字の見やすさ、文字の大きさを、見やすいように変えられます。
          </p>
          <p>
            見た目設定はアカウントではなく端末ごとの設定のため、ログインする前から変えられます。
          </p>
        </>
      }
      related={["add-to-home-screen", "notifications"]}
    >
      <Surface title="見た目設定を開く" gap="md">
        <HelpSteps
          steps={[
            {
              title: "ログイン中は、設定の「見た目設定」を開きます",
              action: <HelpShortcuts target="appearance-settings" />,
            },
            {
              title:
                "ログインする前は、ログイン画面の「見た目設定（文字の大きさ・配色）」を押します",
              body: (
                <p>
                  変え終わったら、見た目設定の画面の上にある「ログイン」からログイン画面に戻れます。ログイン前に変えた設定は、ログインした後もそのまま使われます。
                </p>
              ),
              screenshot: {
                name: "login-appearance-link",
                alt: "ログイン画面。「ログイン」ボタンの下に「見た目設定（文字の大きさ・配色）」のリンクがある",
              },
            },
          ]}
        />
      </Surface>

      <Surface title="変えられる項目" gap="md">
        <HelpSteps
          steps={[
            {
              title: "変えたい項目の選択肢を選びます",
              body: (
                <p>
                  選ぶとすぐに画面に反映され、保存されます。「保存する」ボタンはありません。
                </p>
              ),
              screenshot: {
                name: "appearance-settings",
                alt: "見た目設定の画面。テーマ・アクセントカラー・コントラストの選択肢が並んでいる",
              },
            },
          ]}
        />
        <dl className={styles.terms}>
          <div>
            <dt>テーマ</dt>
            <dd>
              明るい背景の「ライト」、暗い背景の「ダーク」、端末の設定に合わせて切り替わる「システム」から選びます。
            </dd>
          </div>
          <div>
            <dt>アクセントカラー</dt>
            <dd>ボタンやリンクなど、目立たせる部分の色を選びます。</dd>
          </div>
          <div>
            <dt>コントラスト</dt>
            <dd>
              「上げる」にすると、枠線や補助の文字が濃くなり、入力欄やボタンの境目が見やすくなります。
            </dd>
          </div>
          <div>
            <dt>文字サイズ</dt>
            <dd>「小」「中」「大」「特大」から選びます。</dd>
          </div>
        </dl>
        <ul className={styles.points}>
          <li>
            設定は端末（ブラウザ）ごとに保存されます。別のスマートフォンやパソコンでは、それぞれの端末で設定してください。
          </li>
          <li>
            ブラウザの履歴や Cookie
            を消すと、設定がはじめの状態に戻ることがあります。
          </li>
        </ul>
      </Surface>
    </HelpArticle>
  );
}
