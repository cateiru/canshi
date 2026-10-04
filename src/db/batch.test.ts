// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import {
  chunk,
  chunkForBoundParameters,
  chunkRowsForInsert,
  D1_MAX_BOUND_PARAMETERS,
} from "./batch";
import { feedingPresetItems, feedingRecordItems } from "./schema";

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

describe("chunkRowsForInsert", () => {
  it("分割した各 INSERT のバインド数が上限内に収まり、全行を順序どおり含む", async () => {
    const SQL = await initSqlJs();
    const db = drizzle(new SQL.Database());

    // 未使用列にも明示的に null を渡し、全列がバインドされる最悪ケースで確かめる
    const recordRows = Array.from({ length: 30 }, (_, index) => ({
      feedingRecordId: "record",
      foodProductId: `food-${index}`,
      givenAmountG: 40,
      leftoverAmountG: 5,
      estimatedIntakeG: 35,
      estimatedKcal: 31.5,
      givenAmountLevel: null,
      leftoverLevel: null,
      sortOrder: index,
    }));
    const presetRows = Array.from({ length: 40 }, (_, index) => ({
      presetId: "preset",
      foodProductId: `food-${index}`,
      givenAmountG: null,
      givenAmountLevel: "normal" as const,
      sortOrder: index,
    }));

    const recordChunks = chunkRowsForInsert(recordRows, feedingRecordItems);
    const presetChunks = chunkRowsForInsert(presetRows, feedingPresetItems);

    expect(recordChunks.length).toBeGreaterThan(1);
    expect(presetChunks.length).toBeGreaterThan(1);
    expect(recordChunks.flat()).toEqual(recordRows);
    expect(presetChunks.flat()).toEqual(presetRows);
    for (const rows of recordChunks) {
      const { params } = db.insert(feedingRecordItems).values(rows).toSQL();
      expect(params.length).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS);
    }
    for (const rows of presetChunks) {
      const { params } = db.insert(feedingPresetItems).values(rows).toSQL();
      expect(params.length).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS);
    }
  });
});
