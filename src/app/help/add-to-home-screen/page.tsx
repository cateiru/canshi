import type { Metadata } from "next";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpSteps } from "@/features/help/HelpSteps";
import { getHelpTopic } from "@/features/help/topics";
import { ADD_TO_HOME_SCREEN_HELP_SLUG } from "@/features/pwa/installBanner";
import { Surface } from "@/features/shared/Surface";

const SLUG = ADD_TO_HOME_SCREEN_HELP_SLUG;

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default function AddToHomeScreenHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <>
          <p>
            CANSHI
            をホーム画面に追加すると、アプリと同じようにホーム画面のアイコンからすぐに開けます。
          </p>
          <p>
            iPhone・iPad
            では、ホーム画面に追加して開いたときだけ、端末に通知を受け取れます。
          </p>
        </>
      }
      related={["notifications", "households-and-cats"]}
    >
      <Surface title="iPhone・iPad で追加する" gap="md">
        <HelpSteps
          steps={[
            {
              title: "Safari で CANSHI を開きます",
              body: (
                <p>
                  Chrome
                  などほかのブラウザでも、共有メニューから同じように追加できます。
                </p>
              ),
            },
            {
              title: "画面の下（iPad では上）の共有ボタンを押します",
              body: (
                <p>
                  四角から上向きの矢印が出ているボタンです。見当たらないときは、アドレスバーの「…」から「共有」を選んでください。
                </p>
              ),
            },
            {
              title: "メニューから「ホーム画面に追加」を選びます",
              body: (
                <p>
                  見当たらないときは、メニューを下へスクロールしてください。
                </p>
              ),
            },
            {
              title: "右上の「追加」を押します",
              body: (
                <p>
                  ホーム画面に CANSHI
                  のアイコンが追加されます。以降は、このアイコンから開いてください。
                </p>
              ),
            },
          ]}
        />
      </Surface>

      <Surface title="Android で追加する" gap="md">
        <HelpSteps
          steps={[
            {
              title: "Chrome で CANSHI を開きます",
            },
            {
              title:
                "画面の下に出る「ホーム画面に追加しませんか？」の「追加する」を押します",
              body: (
                <p>
                  案内が出ないときは、右上の「︙」のメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。
                </p>
              ),
            },
            {
              title: "確認の画面で「インストール」を押します",
            },
          ]}
        />
      </Surface>

      <Surface title="画面の下の案内について" gap="md">
        <ul className={styles.points}>
          <li>
            ホーム画面に追加していないときは、画面の下に追加を勧める案内が出ます。
          </li>
          <li>案内の「×」を押すと、その端末では 30 日間表示しません。</li>
        </ul>
      </Surface>
    </HelpArticle>
  );
}
