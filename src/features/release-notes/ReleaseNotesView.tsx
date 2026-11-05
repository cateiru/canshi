import { Badge, Breadcrumb } from "@/components/ui";
import { ReleaseNotesIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./ReleaseNotesView.module.css";
import type { ReleaseNote } from "./schema";

type ReleaseNotesViewProps = {
  /** 新しい順に並べたリリースノート。先頭に「最新」を付ける */
  notes: ReleaseNote[];
};

/**
 * 更新情報ページ（`/release-notes`）の中身。
 * VRT では `release-notes.json` を書き換えるたびに差分が出ないよう、固定のダミーデータを
 * 渡した `/dev/release-notes` を撮るため、表示するデータを引数で受け取る
 */
export function ReleaseNotesView({ notes }: ReleaseNotesViewProps) {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "更新情報" },
        ]}
      />

      <RecordPageHeading icon={ReleaseNotesIcon}>更新情報</RecordPageHeading>
      <p>CANSHIに加わった機能や、使いやすさの改善をお届けします。</p>

      {notes.length === 0 ? (
        <Surface className={styles.emptyState}>
          <ReleaseNotesIcon aria-hidden="true" size={32} />
          <p>更新情報はまだありません。</p>
        </Surface>
      ) : (
        <ul className={styles.list}>
          {notes.map((note, index) => (
            <li key={note.version}>
              <article className={styles.release}>
                <div className={styles.meta}>
                  <Badge color="accent">v{note.version}</Badge>
                  {index === 0 ? <Badge color="info">最新</Badge> : null}
                  <time dateTime={note.date} className={styles.date}>
                    {note.date}
                  </time>
                </div>
                <h2 className={styles.title}>{note.title}</h2>
                <ul className={styles.items}>
                  {note.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
