import { describe, expect, it } from "vitest";
import {
  chunk,
  chunkForBoundParameters,
  D1_MAX_BOUND_PARAMETERS,
} from "./batch";

describe("chunk", () => {
  it("指定した件数ずつに分割し、余りは最後の要素にまとめる", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });

  it("0 以下や整数でないサイズは拒否する", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
  });
});

describe("chunkForBoundParameters", () => {
  it("他のパラメーターを差し引いた上限内に収まるよう分割する", () => {
    const ids = Array.from({ length: 250 }, (_, index) => `id-${index}`);
    const chunks = chunkForBoundParameters(ids, 1);
    expect(chunks.map((c) => c.length)).toEqual([99, 99, 52]);
    for (const c of chunks) {
      expect(c.length + 1).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS);
    }
    expect(chunks.flat()).toEqual(ids);
  });

  it("予約するパラメーター数が上限以上なら拒否する", () => {
    expect(() => chunkForBoundParameters([1], D1_MAX_BOUND_PARAMETERS)).toThrow(
      RangeError,
    );
  });
});
