import { describe, expect, it } from "vitest";
import { evaluateSymptomOngoing } from "./symptomOngoing";
import type { OpenSymptom } from "./types";

function makeSymptom(overrides: Partial<OpenSymptom> = {}): OpenSymptom {
  return {
    id: "symptom-1",
    symptomType: "くしゃみ",
    // naive UTC（ローカル時計の 2026-08-11 21:00）
    onsetAt: new Date("2026-08-11T21:00:00.000Z"),
    status: "ongoing",
    hasOpenNotification: false,
    lastAnsweredAt: null,
    ...overrides,
  };
}

describe("evaluateSymptomOngoing", () => {
  it("発症日からちょうど1ヶ月の日に発火する", () => {
    const candidates = evaluateSymptomOngoing(
      "cat-1",
      new Date("2026-09-11T18:00:00.000Z"),
      "UTC",
      true,
      [makeSymptom()],
    );
    expect(candidates).toEqual([
      {
        catId: "cat-1",
        kind: "symptom_ongoing",
        referenceId: "symptom-1",
        dedupeKey: "cat-1:symptom_ongoing:symptom-1:2026-08-11",
        dueAt: new Date("2026-09-11T00:00:00.000Z"),
        symptomId: "symptom-1",
        symptomType: "くしゃみ",
        status: "ongoing",
        elapsedMonths: 1,
      },
    ]);
  });

  it("発症から1ヶ月経つ前日は発火しない", () => {
    const candidates = evaluateSymptomOngoing(
      "cat-1",
      new Date("2026-09-10T18:00:00.000Z"),
      "UTC",
      true,
      [makeSymptom()],
    );
    expect(candidates).toEqual([]);
  });

  it("改善中の症状も対象にし、経過月数は発症日から数える", () => {
    const candidates = evaluateSymptomOngoing(
      "cat-1",
      new Date("2026-11-20T18:00:00.000Z"),
      "UTC",
      true,
      [makeSymptom({ status: "improving" })],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      status: "improving",
      elapsedMonths: 3,
      dueAt: new Date("2026-09-11T00:00:00.000Z"),
    });
  });

  it("未対応の確認通知が残っている症状は、重ねて発火しない", () => {
    const candidates = evaluateSymptomOngoing(
      "cat-1",
      new Date("2026-11-20T18:00:00.000Z"),
      "UTC",
      true,
      [makeSymptom({ hasOpenNotification: true })],
    );
    expect(candidates).toEqual([]);
  });

  it("確認通知に対応した後は、対応した日から1ヶ月後に再び発火する", () => {
    // UTC 2026-09-20 16:00 = JST 2026-09-21 01:00 に「まだ続いている」と答えた
    const symptom = makeSymptom({
      lastAnsweredAt: new Date("2026-09-20T16:00:00.000Z"),
    });
    expect(
      evaluateSymptomOngoing(
        "cat-1",
        new Date("2026-10-20T10:00:00.000Z"),
        "Asia/Tokyo",
        true,
        [symptom],
      ),
    ).toEqual([]);

    const candidates = evaluateSymptomOngoing(
      "cat-1",
      new Date("2026-10-21T10:00:00.000Z"),
      "Asia/Tokyo",
      true,
      [symptom],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      dedupeKey: "cat-1:symptom_ongoing:symptom-1:2026-09-21",
      dueAt: new Date("2026-10-21T00:00:00.000Z"),
      elapsedMonths: 2,
    });
  });

  it("無効化されていれば発火しない", () => {
    const candidates = evaluateSymptomOngoing(
      "cat-1",
      new Date("2026-09-11T18:00:00.000Z"),
      "UTC",
      false,
      [makeSymptom()],
    );
    expect(candidates).toEqual([]);
  });

  it("月末に発症した症状は、翌月に同じ日がなければ繰り越した日に発火する", () => {
    const symptom = makeSymptom({
      onsetAt: new Date("2026-01-31T09:00:00.000Z"),
    });
    expect(
      evaluateSymptomOngoing(
        "cat-1",
        new Date("2026-03-02T18:00:00.000Z"),
        "UTC",
        true,
        [symptom],
      ),
    ).toEqual([]);
    const candidates = evaluateSymptomOngoing(
      "cat-1",
      new Date("2026-03-03T18:00:00.000Z"),
      "UTC",
      true,
      [symptom],
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].elapsedMonths).toBe(1);
  });

  it("複数の症状があればそれぞれ候補を返す", () => {
    const candidates = evaluateSymptomOngoing(
      "cat-1",
      new Date("2026-09-11T18:00:00.000Z"),
      "UTC",
      true,
      [
        makeSymptom({ id: "symptom-1" }),
        makeSymptom({ id: "symptom-2", symptomType: "咳" }),
      ],
    );
    expect(candidates.map((c) => c.referenceId)).toEqual([
      "symptom-1",
      "symptom-2",
    ]);
  });
});
