import releaseNotesJson from "./release-notes.json";
import { type ReleaseNote, releaseNotesSchema } from "./schema";

/** 新しい日付順（同日なら記載順を保ったまま）に並べ替える */
export function sortReleaseNotes(notes: ReleaseNote[]): ReleaseNote[] {
  return [...notes].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
}

/**
 * `release-notes.json` を検証し、新しい日付順に並べ替えて返す。
 * 開発時に不正なデータを書いてしまった場合、ページ表示前に気付けるようここで検証する。
 */
export function listReleaseNotes(): ReleaseNote[] {
  return sortReleaseNotes(releaseNotesSchema.parse(releaseNotesJson));
}
