import type { Metadata } from "next";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpSteps } from "@/features/help/HelpSteps";
import { getHelpTopic } from "@/features/help/topics";
import { NOTIFY_TIME } from "@/features/notifications/domain/defaults";
import { Surface } from "@/features/shared/Surface";

const SLUG = "notifications";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default function NotificationsHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <>
          <p>
            CANSHI
            は、ごはんの時間や記念日、お手入れの時期などをお知らせします。お知らせは画面右上のベルのアイコンからいつでも確認できます。
          </p>
          <p>
            端末の通知をオンにすると、アプリを開いていないときもスマートフォンやパソコンにお知らせが届きます。
          </p>
        </>
      }
      related={["household-food", "records/cleaning"]}
    >
      <Surface title="この端末で通知を受け取る" gap="md">
        <HelpSteps
          steps={[
            {
              title: "設定の「通知設定」を開きます",
            },
            {
              title: "「この端末で通知を受け取る」をオンにします",
              body: (
                <>
                  <p>
                    ブラウザから通知の許可を求められたら、「許可」を選んでください。通知の受け取りは端末ごとの設定のため、使っている端末ごとにオンにします。
                  </p>
                  <p>
                    オンにした後、「テスト通知を送る」で、この端末に通知が届くかを確かめられます。
                  </p>
                </>
              ),
              screenshot: {
                name: "notification-settings",
                alt: "通知設定の画面。お知らせが届く時間の案内と、「この端末で通知を受け取る」のチェックボックスが並んでいる",
              },
            },
          ]}
        />
        <ul className={styles.points}>
          <li>
            iPhone・iPad では、Safari
            の共有メニューから「ホーム画面に追加」をして、ホーム画面から CANSHI
            を開いてから通知をオンにしてください。
          </li>
          <li>
            通知の許可を「許可しない」にしてしまったときは、ブラウザや端末の設定から
            CANSHI の通知を許可し直してください。
          </li>
        </ul>
      </Surface>

      <Surface title="届くお知らせ" gap="md">
        <p>
          ねこのお知らせは、毎日 {NOTIFY_TIME}
          （日本時間）に届きます。ごはんのお知らせと、通知時刻を指定した掃除のお知らせは、それぞれ決めた時刻に届きます。
        </p>
        <dl className={styles.terms}>
          <div>
            <dt>ごはん</dt>
            <dd>
              家の「ごはんの時間」に登録した時間にお知らせします。記録がないときは「ごはんはあげましたか？」と確認します。
            </dd>
          </div>
          <div>
            <dt>誕生日</dt>
            <dd>
              年ごとの誕生日、半年ごとの節目、生後100日ごとの節目をお知らせします。
            </dd>
          </div>
          <div>
            <dt>シャンプー</dt>
            <dd>前回のシャンプーから、決めた月数が経つとお知らせします。</dd>
          </div>
          <div>
            <dt>体重測定</dt>
            <dd>前回の体重測定から、決めた日数が経つとお知らせします。</dd>
          </div>
          <div>
            <dt>症状</dt>
            <dd>
              1ヶ月以上「解消」になっていない症状があると、解消したかを確認します。
            </dd>
          </div>
          <div>
            <dt>掃除</dt>
            <dd>掃除の対象ごとに、次の予定日になるとお知らせします。</dd>
          </div>
        </dl>
      </Surface>

      <Surface title="ねこごとにお知らせを選ぶ" gap="md">
        <HelpSteps
          steps={[
            {
              title: "通知設定の「ねこごとの通知設定」から、ねこを選びます",
            },
            {
              title:
                "受け取りたいお知らせにチェックを入れて「保存する」を押します",
              body: (
                <p>
                  シャンプーは何ヶ月ごと、体重測定は何日ごとにお知らせするかも変えられます。メモリーへ移したねこのお知らせは届きません。
                </p>
              ),
              screenshot: {
                name: "cat-notification-settings",
                alt: "ねこごとの通知設定の画面。誕生日・シャンプー・体重測定のお知らせのチェックボックスが並んでいる",
              },
            },
          ]}
        />
      </Surface>
    </HelpArticle>
  );
}
