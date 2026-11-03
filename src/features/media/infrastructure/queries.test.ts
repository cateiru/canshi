import { describe, expect, it } from "vitest";
import { D1_MAX_BOUND_PARAMETERS } from "@/db/batch";
import { packRecordRefs } from "./queries";

function ids(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

describe("packRecordRefs", () => {
  it("上限に収まる範囲では 1 クエリにまとめる", () => {
    const batches = packRecordRefs(
      new Map([
        ["poop_record", ids("p", 40)],
        ["vomit_record", ids("v", 50)],
      ]),
    );
    expect(batches).toHaveLength(1);
    expect(batches[0].map(([type, list]) => [type, list.length])).toEqual([
      ["poop_record", 40],
      ["vomit_record", 50],
    ]);
  });

  it("種別ごとの recordType 分を含めてバインドパラメーターが上限を超えないよう分割する", () => {
    const batches = packRecordRefs(
      new Map([
        ["poop_record", ids("p", 150)],
        ["vomit_record", ids("v", 60)],
      ]),
    );
    for (const batch of batches) {
      const parameters = batch.reduce(
        (sum, [, list]) => sum + 1 + list.length,
        0,
      );
      expect(parameters).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS);
    }
    // 150 件は 99 + 51 に分かれ、51 件のチャンクと 60 件の種別は同居できないので 3 クエリになる
    expect(
      batches.map((batch) => batch.map(([, list]) => list.length)),
    ).toEqual([[99], [51], [60]]);
    expect(batches.flat().flatMap(([, list]) => list)).toEqual([
      ...ids("p", 150),
      ...ids("v", 60),
    ]);
  });
});
