import { describe, expect, it } from "vitest";
import { listReleaseNotes, sortReleaseNotes } from "./data";

describe("listReleaseNotes", () => {
  it("release-notes.json がスキーマに沿っており、1件以上返す", () => {
    const notes = listReleaseNotes();
    expect(notes.length).toBeGreaterThan(0);
  });
});

describe("sortReleaseNotes", () => {
  it("日付の新しい順に並べ替える", () => {
    const sorted = sortReleaseNotes([
      { version: "0.1.0", date: "2026-01-01", title: "古い", items: ["a"] },
      { version: "0.2.0", date: "2026-03-01", title: "新しい", items: ["b"] },
    ]);

    expect(sorted.map((note) => note.version)).toEqual(["0.2.0", "0.1.0"]);
  });

  it("同じ日付なら後から記載した方を新しいものとして先に表示する", () => {
    const sorted = sortReleaseNotes([
      { version: "0.1.0", date: "2026-01-01", title: "先", items: ["a"] },
      { version: "0.1.1", date: "2026-01-01", title: "後", items: ["b"] },
    ]);

    expect(sorted.map((note) => note.version)).toEqual(["0.1.1", "0.1.0"]);
  });
});
