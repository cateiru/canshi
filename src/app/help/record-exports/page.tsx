import type { Metadata } from "next";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpShortcuts } from "@/features/help/HelpShortcuts";
import { HelpSteps } from "@/features/help/HelpSteps";
import { getHelpTopic } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

const SLUG = "record-exports";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default function RecordExportsHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <>
          <p>
            家の記録を CSV ファイルに書き出し、zip
            ファイルにまとめてダウンロードできます。表計算ソフトで見返したり、動物病院に見せる資料を作ったり、ほかのアプリに移したりするときに使えます。
          </p>
          <p>
            家のすべてのねこの記録を出力します。家のメンバーなら誰でも出力・ダウンロードできます。
          </p>
        </>
      }
      related={["records", "households-and-cats"]}
    >
      <Surface title="記録を出力する" gap="md">
        <HelpSteps
          steps={[
            {
              title: "家の設定の「記録の出力」を開きます",
              action: <HelpShortcuts target="record-exports" />,
              body: (
                <p>
                  設定の「家の設定」から家を選び、「記録」の「記録の出力」を押します。
                </p>
              ),
            },
            {
              title: "出力する記録を選び、「出力する」を押します",
              body: (
                <>
                  <p>
                    はじめはすべての記録が選ばれています。「写真・動画を含める」にチェックを入れると、記録に添付した写真・動画もまとめます。
                  </p>
                  <p>
                    出力には時間がかかることがあります。ページを離れても出力は続きます。出力しているあいだは、この家で新しく出力することはできません。
                  </p>
                </>
              ),
              screenshot: {
                name: "record-exports",
                alt: "記録の出力の画面。出力する記録の種類のチェックボックスと「写真・動画を含める」、「出力する」ボタンが並んでいる",
              },
            },
            {
              title: "完了したら「ダウンロード」を押します",
              body: (
                <>
                  <p>
                    出力が終わると「出力したファイル」に表示され、何度でもダウンロードできます。
                  </p>
                  <p>
                    いらなくなったファイルは、ごみ箱のボタンで削除できます。ファイルを削除しても、記録そのものは消えません。
                  </p>
                </>
              ),
              screenshot: {
                name: "record-exports-download",
                alt: "出力したファイルの一覧。完了した出力に「ダウンロード」ボタンがある",
              },
            },
          ]}
        />
      </Surface>

      <Surface title="zip ファイルの中身" gap="md">
        <ul className={styles.points}>
          <li>
            記録の種類ごとに CSV ファイル（feeding_records.csv
            など）が入っています。Excel などの表計算ソフトでそのまま開けます。
          </li>
          <li>
            日時は、画面に表示されるのと同じ日本時間で書かれています。削除した記録は含まれません。
          </li>
          <li>
            ごはん記録は、あげた商品ごとに 1 行になります。同じ食事の行は、同じ
            ID になります。
          </li>
          <li>
            服薬記録は、服薬予定（medications.csv）と、投薬の記録（medication_doses.csv）の
            2 つのファイルに分かれます。
          </li>
          <li>
            写真・動画を含めたときは、photos フォルダに記録ごとに入ります。CSV
            の「写真・動画」の列に、zip ファイルの中の場所が書かれています。
          </li>
        </ul>
      </Surface>

      <Surface title="出力できないとき" gap="md">
        <p>
          写真・動画が多く、zip ファイルが 4 GB
          を超えるときは出力できません。写真・動画を含めずに出力するか、記録の種類を分けて出力してください。
        </p>
      </Surface>
    </HelpArticle>
  );
}
