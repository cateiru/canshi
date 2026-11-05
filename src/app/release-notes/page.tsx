import { listReleaseNotes } from "@/features/release-notes/data";
import { ReleaseNotesView } from "@/features/release-notes/ReleaseNotesView";

export default function ReleaseNotesPage() {
  return <ReleaseNotesView notes={listReleaseNotes()} />;
}
