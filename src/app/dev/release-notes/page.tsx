import { notFound } from "next/navigation";
import { sortReleaseNotes } from "@/features/release-notes/data";
import { ReleaseNotesView } from "@/features/release-notes/ReleaseNotesView";
import { releaseNotesSchema } from "@/features/release-notes/schema";
import fixture from "./release-notes.fixture.json";

/**
 * 更新情報ページ（`/release-notes`）を、固定のダミーデータで表示する開発用ページ。
 * 本物の `release-notes.json` は変更のたびに追記されるため、VRT（e2e/vrt.spec.ts）では
 * こちらを撮って、リリースノートの追記で差分が出ないようにする。本番では表示しない
 */
export default function ReleaseNotesDevPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <ReleaseNotesView
      notes={sortReleaseNotes(releaseNotesSchema.parse(fixture))}
    />
  );
}
