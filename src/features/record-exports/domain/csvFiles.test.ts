import { describe, expect, it } from "vitest";
import {
  expenseCsvFile,
  feedingCsvFile,
  medicationCsvFiles,
  memoCsvFile,
  poopCsvFile,
  recordExportMediaPath,
  weightCsvFile,
} from "./csvFiles";

const timestamps = {
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  deletedAt: null,
};

describe("recordExportMediaPath", () => {
  it("CSV のファイル名のフォルダに、記録の ID と順番で置く", () => {
    expect(recordExportMediaPath("poop", "r1", 0, "image/jpeg")).toBe(
      "photos/poop_records/r1-1.jpg",
    );
    expect(
      recordExportMediaPath("medication", "m1", 1, "video/quicktime"),
    ).toBe("photos/medications/m1-2.mov");
    expect(recordExportMediaPath("memo", "x", 0, "application/unknown")).toBe(
      "photos/memo_records/x-1.bin",
    );
  });
});

describe("feedingCsvFile", () => {
  it("商品ごとに 1 行にし、モードに合わせて量の列を埋める。量の単位を添え、カロリーは丸める", () => {
    const file = feedingCsvFile([
      {
        id: "f1",
        catId: "c1",
        catName: "たま",
        occurredAt: new Date("2026-06-01T08:30:00Z"),
        mode: "strict",
        memo: "完食",
        ...timestamps,
        items: [
          {
            id: "i1",
            feedingRecordId: "f1",
            foodProductId: "p1",
            productName: "カリカリ",
            amountUnit: "g",
            givenAmountG: 30,
            leftoverAmountG: 5,
            estimatedIntakeG: 25,
            estimatedKcal: 87.549999,
            givenAmountLevel: null,
            leftoverLevel: null,
            sortOrder: 0,
          },
          {
            id: "i2",
            feedingRecordId: "f1",
            foodProductId: "p2",
            productName: "スープ",
            amountUnit: "ml",
            givenAmountG: 40,
            leftoverAmountG: 0,
            estimatedIntakeG: 40,
            estimatedKcal: 30,
            givenAmountLevel: null,
            leftoverLevel: null,
            sortOrder: 1,
          },
        ],
      },
      {
        id: "f2",
        catId: "c1",
        catName: "たま",
        occurredAt: new Date("2026-06-01T19:00:00Z"),
        mode: "approximate",
        memo: null,
        ...timestamps,
        items: [
          {
            id: "i3",
            feedingRecordId: "f2",
            foodProductId: "p1",
            productName: "カリカリ",
            amountUnit: "g",
            givenAmountG: null,
            leftoverAmountG: null,
            estimatedIntakeG: null,
            estimatedKcal: null,
            givenAmountLevel: "more",
            leftoverLevel: "little",
            sortOrder: 0,
          },
        ],
      },
    ]);
    expect(file.fileName).toBe("feeding_records.csv");
    expect(file.rows).toEqual([
      [
        "f1",
        "たま",
        "2026-06-01 08:30",
        "厳格モード",
        "カリカリ",
        "g",
        30,
        5,
        25,
        87.5,
        null,
        null,
        "完食",
      ],
      [
        "f1",
        "たま",
        "2026-06-01 08:30",
        "厳格モード",
        "スープ",
        "ml",
        40,
        0,
        40,
        30,
        null,
        null,
        "完食",
      ],
      [
        "f2",
        "たま",
        "2026-06-01 19:00",
        "あいまいモード",
        "カリカリ",
        "g",
        null,
        null,
        null,
        null,
        "多め",
        "少し残し",
        null,
      ],
    ]);
  });
});

describe("写真・動画の列", () => {
  const poop = {
    id: "p1",
    catId: "c1",
    catName: "たま",
    occurredAt: new Date("2026-06-01T08:00:00Z"),
    amount: "ふつう",
    color: "茶色",
    consistency: "soft" as const,
    hasBlood: true,
    hasForeignObject: false,
    appetiteNote: null,
    energyNote: null,
    memo: null,
    ...timestamps,
  };

  it("写真・動画を含めないときは列を作らない", () => {
    const file = poopCsvFile([poop], undefined);
    expect(file.columns).not.toContain("写真・動画");
    expect(file.rows[0]).toEqual([
      "p1",
      "たま",
      "2026-06-01 08:00",
      "柔らかい",
      "ふつう",
      "茶色",
      "はい",
      "いいえ",
      null,
      null,
      null,
    ]);
  });

  it("含めるときは、記録の写真・動画のパスを改行で区切って最後の列に入れる", () => {
    const file = poopCsvFile(
      [poop, { ...poop, id: "p2" }],
      new Map([
        [
          "p1",
          ["photos/poop_records/p1-1.jpg", "photos/poop_records/p1-2.mp4"],
        ],
      ]),
    );
    expect(file.columns.at(-1)).toBe("写真・動画");
    expect(file.rows.map((row) => row.at(-1))).toEqual([
      "photos/poop_records/p1-1.jpg\nphotos/poop_records/p1-2.mp4",
      null,
    ]);
  });
});

describe("そのほかの記録", () => {
  it("体重は BCS を「3（理想体重）」の形にする", () => {
    const file = weightCsvFile([
      {
        id: "w1",
        catId: "c1",
        catName: "たま",
        occurredAt: new Date("2026-06-01T08:00:00Z"),
        inputMethod: "direct",
        combinedWeightKg: null,
        humanWeightKg: null,
        catWeightKg: 4.2,
        bcs: 3,
        memo: null,
        ...timestamps,
      },
    ]);
    expect(file.rows[0]).toEqual([
      "w1",
      "たま",
      "2026-06-01 08:00",
      "直接入力",
      4.2,
      null,
      null,
      "3（理想体重）",
      null,
    ]);
  });

  it("服薬記録は服薬予定と投薬の記録の 2 つのファイルにする", () => {
    const files = medicationCsvFiles(
      [
        {
          id: "m1",
          catId: "c1",
          catName: "たま",
          symptomId: null,
          name: "点眼薬",
          doseAmount: "1滴",
          dosesPerDay: 2,
          startDate: "2026-06-01",
          endDate: null,
          hospitalVisitId: "h1",
          // 実際の日時（UTC）。日本時間で書く
          archivedAt: new Date("2026-06-10T15:30:00Z"),
          ...timestamps,
        },
      ],
      [
        {
          id: "d1",
          catId: "c1",
          catName: "たま",
          medicationId: "m1",
          medicationName: "点眼薬",
          occurredAt: new Date("2026-06-02T09:00:00Z"),
          wasAdministered: false,
          memo: "嫌がった",
          ...timestamps,
        },
      ],
      undefined,
    );
    expect(files.map(({ fileName }) => fileName)).toEqual([
      "medications.csv",
      "medication_doses.csv",
    ]);
    expect(files[0].rows[0]).toEqual([
      "m1",
      "たま",
      "点眼薬",
      "1滴",
      2,
      "2026-06-01",
      null,
      null,
      "h1",
      "2026-06-11 00:30",
    ]);
    expect(files[1].rows[0]).toEqual([
      "d1",
      "たま",
      "m1",
      "点眼薬",
      "2026-06-02 09:00",
      "いいえ",
      "嫌がった",
    ]);
  });

  it("支出は日付だけにし、関連するねこを「、」でつなぐ", () => {
    const file = expenseCsvFile(
      [
        {
          id: "e1",
          householdId: "home",
          spentAt: new Date("2026-06-01T00:00:00Z"),
          amountYen: 3300,
          category: "hospital",
          memo: null,
          catNames: ["たま", "みけ"],
          hospitalVisitIds: ["h1", "h2"],
          ...timestamps,
        },
      ],
      undefined,
    );
    expect(file.rows[0]).toEqual([
      "e1",
      "2026-06-01",
      "病院",
      3300,
      "たま、みけ",
      "h1\nh2",
      null,
    ]);
  });

  it("日付を残さないメモは日時を空にする", () => {
    const file = memoCsvFile(
      [
        {
          id: "n1",
          catId: "c1",
          catName: "たま",
          recordedAt: null,
          content: "好きなおもちゃ",
          labelNames: ["好きなもの", "大事"],
          ...timestamps,
        },
      ],
      undefined,
    );
    expect(file.rows[0]).toEqual([
      "n1",
      "たま",
      null,
      "好きなもの、大事",
      "好きなおもちゃ",
    ]);
  });
});
