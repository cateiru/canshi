import { describe, expect, it } from "vitest";
import { parseContrast, parseFontSize, parseTheme } from "./preferences";

describe("parseTheme", () => {
  it.each(["light", "dark", "system"] as const)(
    "%s はそのまま使う",
    (value) => {
      expect(parseTheme(value)).toBe(value);
    },
  );

  it.each([undefined, "", "Dark", "auto"])(
    "未設定・不正な値（%s）はシステムにする",
    (value) => {
      expect(parseTheme(value)).toBe("system");
    },
  );
});

describe("parseContrast", () => {
  it.each(["default", "more"] as const)("%s はそのまま使う", (value) => {
    expect(parseContrast(value)).toBe(value);
  });

  it.each([undefined, "", "high", "less"])(
    "未設定・不正な値（%s）はデフォルトにする",
    (value) => {
      expect(parseContrast(value)).toBe("default");
    },
  );
});

describe("parseFontSize", () => {
  it.each(["small", "medium", "large", "xlarge"] as const)(
    "%s はそのまま使う",
    (value) => {
      expect(parseFontSize(value)).toBe(value);
    },
  );

  it.each([undefined, "", "Large", "xxlarge"])(
    "未設定・不正な値（%s）は中にする",
    (value) => {
      expect(parseFontSize(value)).toBe("medium");
    },
  );
});
