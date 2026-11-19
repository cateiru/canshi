import type { Metadata } from "next";
import { listReleaseNotes } from "@/features/release-notes/data";
import { ReleaseNotesView } from "@/features/release-notes/ReleaseNotesView";
import { parsePageParam } from "@/features/shared/pagination";

export const metadata: Metadata = {
  title: "更新情報",
};

type ReleaseNotesPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

export default async function ReleaseNotesPage({
  searchParams,
}: ReleaseNotesPageProps) {
  const { page } = await searchParams;
  return (
    <ReleaseNotesView
      notes={listReleaseNotes()}
      page={parsePageParam(page)}
      basePath="/release-notes"
    />
  );
}
