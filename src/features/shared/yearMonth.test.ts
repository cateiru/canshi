import { describe, expect, it } from "vitest";
import { formatYm, parseYm, shiftYm } from "./yearMonth";

const FALLBACK = { year: 2026, month: 9 };

describe("parseYm", () => {
  it("YYYY-MM をパースする", () => {
    expect(parseYm("2025-01", FALLBACK)).toEqual({ year: 2025, month: 1 });
  });

  it("未指定・書式違反・範囲外は fallback を返す", () => {
    expect(parseYm(undefined, FALLBACK)).toEqual(FALLBACK);
    expect(parseYm("2026-9", FALLBACK)).toEqual(FALLBACK);
    expect(parseYm("2026-13", FALLBACK)).toEqual(FALLBACK);
    expect(parseYm("1969-12", FALLBACK)).toEqual(FALLBACK);
  });
});

describe("formatYm", () => {
  it("月を2桁にそろえる", () => {
    expect(formatYm({ year: 2026, month: 9 })).toBe("2026-09");
  });
});

describe("shiftYm", () => {
  it("前後の月に移動する", () => {
    expect(shiftYm({ year: 2026, month: 9 }, 1)).toEqual({
      year: 2026,
      month: 10,
    });
    expect(shiftYm({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
    expect(shiftYm({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
  });
});
