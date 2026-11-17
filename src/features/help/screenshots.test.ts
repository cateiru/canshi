import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_SCREENSHOT_NAMES, helpScreenshotSrc } from "./screenshots";

describe("ヘルプのスクリーンショット", () => {
  it.each(HELP_SCREENSHOT_NAMES)("%s の画像がある", (name) => {
    expect(
      existsSync(join(process.cwd(), "public", helpScreenshotSrc(name))),
    ).toBe(true);
  });
});
