import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEV_PAGES } from "./devPages";

const DEV_DIR = join(process.cwd(), "src/app/dev");

describe("DEV_PAGES", () => {
  it("src/app/dev の下のページをすべて、1 度ずつ並べる", () => {
    const slugs = readdirSync(DEV_DIR, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          existsSync(join(DEV_DIR, entry.name, "page.tsx")),
      )
      .map((entry) => entry.name)
      .sort();

    expect(DEV_PAGES.map(({ slug }) => slug).sort()).toEqual(slugs);
  });
});
