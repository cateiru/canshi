import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = join(process.cwd(), "src/app");

/** リダイレクトするだけで画面を持たないページ・既定の「CANSHI」のままにするページ */
const PAGES_WITHOUT_TITLE = new Set([
  "page.tsx",
  "home/page.tsx",
  "settings/login/page.tsx",
  "settings/profile/page.tsx",
  "households/[householdId]/feeding-records/new/page.tsx",
]);

function listPages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return listPages(path);
    }
    return entry.name === "page.tsx" ? [relative(APP_DIR, path)] : [];
  });
}

// 開発用のページ（`/dev/*`）は本番で表示しないため対象外にする
const pages = listPages(APP_DIR).filter((page) => !page.startsWith("dev/"));

describe("ページの title", () => {
  it.each(pages)("%s", (page) => {
    const source = readFileSync(join(APP_DIR, page), "utf8");
    // 「 | CANSHI」はルートレイアウトのテンプレートが付けるため、ページには書かない
    expect(source).not.toContain("| CANSHI");
    if (PAGES_WITHOUT_TITLE.has(page)) {
      return;
    }
    expect(source).toMatch(
      /export (const metadata\b|const generateMetadata\b|async function generateMetadata\b)/,
    );
  });
});
