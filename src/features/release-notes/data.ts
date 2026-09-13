import releaseNotesJson from "./release-notes.json";
import { type ReleaseNote, releaseNotesSchema } from "./schema";

/** 新しい日付順（同日なら後から追記した方を新しいとみなし、記載順と逆に並べる）に並べ替える */
export function sortReleaseNotes(notes: ReleaseNote[]): ReleaseNote[] {
  return notes
    .map((note, index) => ({ note, index }))
    .sort((a, b) => {
      if (a.note.date !== b.note.date) {
        return a.note.date < b.note.date ? 1 : -1;
      }
      return b.index - a.index;
    })
    .map(({ note }) => note);
}

/**
 * `release-notes.json` を検証し、新しい日付順に並べ替えて返す。
 * 開発時に不正なデータを書いてしまった場合、ページ表示前に気付けるようここで検証する。
 */
export function listReleaseNotes(): ReleaseNote[] {
  return sortReleaseNotes(releaseNotesSchema.parse(releaseNotesJson));
}
