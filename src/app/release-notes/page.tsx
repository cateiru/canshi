import type { Metadata } from "next";
import { listReleaseNotes } from "@/features/release-notes/data";
import { ReleaseNotesView } from "@/features/release-notes/ReleaseNotesView";

export const metadata: Metadata = {
  title: "更新情報",
};

export default function ReleaseNotesPage() {
  return <ReleaseNotesView notes={listReleaseNotes()} />;
}
