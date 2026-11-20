import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("前後の空白を除いて小文字にする", () => {
    expect(normalizeEmail(" Foo@Example.com\n")).toBe("foo@example.com");
  });
});
