import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RECORD_NAV_ITEMS } from "@/features/cats/presentation/recordNav";
import { RECORD_HELPS } from "./recordHelps";
import { getHelpTopic, HELP_CATEGORIES, recordHelpSlug } from "./topics";

const HELP_APP_DIR = join(process.cwd(), "src/app/help");
const topics = HELP_CATEGORIES.flatMap((category) => category.topics);

describe("ヘルプの記事", () => {
  it("slug が重複しない", () => {
    const slugs = topics.map((topic) => topic.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(topics.map((topic) => topic.slug))("%s のページがある", (slug) => {
    // 記録ごとのヘルプは `records/[recordType]` の 1 つのページで表示する
    const page = slug.startsWith("records/")
      ? join(HELP_APP_DIR, "records/[recordType]/page.tsx")
      : join(HELP_APP_DIR, slug, "page.tsx");
    expect(existsSync(page)).toBe(true);
  });

  it("記録ごとのヘルプのあわせて読む記事がすべてある", () => {
    for (const record of RECORD_HELPS) {
      for (const slug of record.related ?? []) {
        expect(() => getHelpTopic(slug)).not.toThrow();
      }
    }
  });

  it("見つからない slug は例外にする", () => {
    expect(() => getHelpTopic("unknown")).toThrow();
  });
});

describe("記録ごとのヘルプ", () => {
  // ねこの詳細ページの記録の導線（タイムラインを除く）と、同じ種類・同じ順・同じ名前にする
  const recordNavItems = RECORD_NAV_ITEMS.filter(
    (item) => item.label !== "タイムライン",
  );

  it("ねこの詳細ページの記録の種類と同じ順に並ぶ", () => {
    expect(RECORD_HELPS.map((record) => record.title)).toEqual(
      recordNavItems.map((item) => item.label),
    );
  });

  it("記録のページと同じパスを使う", () => {
    expect(
      RECORD_HELPS.map((record) => `/cats/cat-1/${record.recordType}`),
    ).toEqual(recordNavItems.map((item) => item.href("cat-1")));
  });

  it("記録の種類の slug は records/ の下になる", () => {
    expect(recordHelpSlug("poop-records")).toBe("records/poop-records");
  });
});
