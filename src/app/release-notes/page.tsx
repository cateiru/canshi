import { Alert, Breadcrumb, Card } from "@/components/ui";
import { listReleaseNotes } from "@/features/release-notes/data";
import styles from "./page.module.css";

export default function ReleaseNotesPage() {
  const notes = listReleaseNotes();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/home" }, { label: "更新情報" }]}
      />

      <h1>更新情報</h1>

      {notes.length === 0 ? (
        <Alert color="info">更新情報はまだありません。</Alert>
      ) : (
        <ul className={styles.list}>
          {notes.map((note) => (
            <li key={note.version}>
              <Card title={`v${note.version} ${note.title}`}>
                <time dateTime={note.date} className={styles.date}>
                  {note.date}
                </time>
                <ul className={styles.items}>
                  {note.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
