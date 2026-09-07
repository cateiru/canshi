import { describe, expect, it } from "vitest";
import { checkboxBooleanSchema } from "./checkbox";

describe("checkboxBooleanSchema", () => {
  it("チェックあり（on）は true になる", () => {
    expect(checkboxBooleanSchema.parse("on")).toBe(true);
  });

  it("未送信（null）は false になる", () => {
    expect(checkboxBooleanSchema.parse(null)).toBe(false);
  });
});
