import type { Metadata } from "next";
import { NavCard } from "@/components/ui";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpScreenshot } from "@/features/help/HelpScreenshot";
import { HelpSteps } from "@/features/help/HelpSteps";
import { RECORD_HELPS } from "@/features/help/recordHelps";
import { getHelpTopic, helpHref, recordHelpSlug } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

const SLUG = "records";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default function RecordsHelpPage() {
  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <p>
          記録は、ねこごとにつけます。ねこ一覧からねこを選ぶと、記録の種類ごとの入り口が並んでいます。記録は同じ家のメンバー全員で共有されます。
        </p>
      }
      related={["households-and-cats", "household-food"]}
    >
      <Surface title="記録を追加する" gap="md">
        <HelpSteps
          steps={[
            {
              title: "ねこ一覧から、記録したいねこを選びます",
            },
            {
              title: "ねこの画面で、記録したい種類を選びます",
              screenshot: {
                name: "cat-detail",
                alt: "ねこの画面。ごはん記録・うんち記録・体重記録などのボタンが並んでいる",
              },
            },
            {
              title: "記録の一覧で「記録する」を押し、内容を入力して保存します",
              body: (
                <p>
                  日時は、最初は今の日時が入っています。あとから思い出して記録するときは、日時を変えてから保存してください。
                </p>
              ),
              screenshot: {
                name: "record-list",
                alt: "うんち記録の一覧。右上に「記録する」ボタンがあり、記録がカードで並んでいる",
              },
            },
          ]}
        />
      </Surface>

      <Surface title="記録を直す・削除する" gap="md">
        <ul className={styles.points}>
          <li>
            記録の一覧で、記録の右上の鉛筆のボタン（編集する）を押すと内容を直せます。削除もここから行えます。
          </li>
          <li>
            記録には、作成・編集した人のアイコンが表示されます。押すと、だれがいつ記録・編集したかの履歴を確認できます。
          </li>
          <li>
            メモリーへ移したねこの記録は、見返すことだけができます（追加・編集・削除はできません）。
          </li>
        </ul>
      </Surface>

      <Surface title="タイムラインで見返す" gap="md">
        <p>
          ねこの画面の「タイムライン」では、すべての種類の記録を新しい順にまとめて見られます。カレンダーには、記録のある日に記録の種類のアイコンが表示され、日付を押すとその日の記録だけを表示します。
        </p>
        <HelpScreenshot
          name="timeline"
          alt="タイムラインの画面。月のカレンダーの日付に記録のアイコンが並び、その下に記録が新しい順に並んでいる"
          caption="タイムライン"
        />
      </Surface>

      <Surface title="記録の種類" gap="md">
        <ul className={styles.cardList}>
          {RECORD_HELPS.map((record) => (
            <li key={record.recordType}>
              <NavCard
                href={helpHref(recordHelpSlug(record.recordType))}
                icon={record.icon}
                title={record.title}
                titleAs="h3"
                description={record.summary}
              />
            </li>
          ))}
        </ul>
      </Surface>
    </HelpArticle>
  );
}
