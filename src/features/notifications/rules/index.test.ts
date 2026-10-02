import { describe, expect, it } from "vitest";
import type { Cat } from "@/db/schema";
import { evaluateNotificationRules } from "./index";
import type { OpenSymptom, ResolvedNotificationSettings } from "./types";

function makeCat(overrides: Partial<Cat> = {}): Cat {
  return {
    id: "cat-1",
    name: "たま",
    sex: "female",
    birthDate: "2025-09-11",
    birthDatePrecision: "day",
    breed: null,
    adoptedAt: null,
    profileMediaAssetId: null,
    createdAt: new Date("2025-09-11T00:00:00.000Z"),
    updatedAt: new Date("2025-09-11T00:00:00.000Z"),
    ...overrides,
  };
}

const allEnabledSettings: ResolvedNotificationSettings = {
  birthdayYearly: { isEnabled: true },
  birthdayHalfYear: { isEnabled: true },
  daysMilestone: { isEnabled: true },
  shampooElapsed: { isEnabled: true, months: 2 },
  weightMeasurement: { isEnabled: true, days: 14 },
  cleaningDue: new Map(),
  symptomOngoing: { isEnabled: true },
};

const longOngoingSymptom: OpenSymptom = {
  id: "symptom-1",
  symptomType: "くしゃみ",
  onsetAt: new Date("2026-08-11T09:00:00.000Z"),
  status: "ongoing",
  hasOpenNotification: false,
  lastAnsweredAt: null,
};

describe("evaluateNotificationRules", () => {
  it("誕生日（1年）だけを返し、生後6か月ごとの節目とは二重に発火しない", () => {
    const candidates = evaluateNotificationRules({
      now: new Date("2026-09-11T18:00:00.000Z"),
      timezone: "UTC",
      cat: makeCat({ birthDate: "2025-09-11" }),
      settings: allEnabledSettings,
      latestShampooAt: null,
      latestWeightAt: null,
      cleaningTargets: [],
      openSymptoms: [],
    });

    expect(candidates.map((c) => c.kind)).toEqual(["birthday_yearly"]);
  });

  it("種類ごとに設定を無効化すると生成されない", () => {
    const candidates = evaluateNotificationRules({
      now: new Date("2026-09-11T18:00:00.000Z"),
      timezone: "UTC",
      cat: makeCat({ birthDate: "2025-09-11" }),
      settings: {
        ...allEnabledSettings,
        birthdayYearly: { isEnabled: false },
      },
      latestShampooAt: null,
      latestWeightAt: null,
      cleaningTargets: [],
      openSymptoms: [],
    });

    expect(candidates).toEqual([]);
  });

  it("複数の種類が同日に条件を満たせばまとめて返す", () => {
    const candidates = evaluateNotificationRules({
      now: new Date("2026-09-11T18:00:00.000Z"),
      timezone: "UTC",
      cat: makeCat({ birthDate: "2025-09-11" }),
      settings: allEnabledSettings,
      latestShampooAt: new Date("2026-07-11T00:00:00.000Z"),
      latestWeightAt: new Date("2026-08-28T00:00:00.000Z"),
      cleaningTargets: [],
      openSymptoms: [],
    });

    expect(candidates.map((c) => c.kind).sort()).toEqual(
      ["birthday_yearly", "shampoo_elapsed", "weight_measurement"].sort(),
    );
  });

  it("18:00 より前は掃除以外の通知を生成しない", () => {
    const candidates = evaluateNotificationRules({
      now: new Date("2026-09-11T17:45:00.000Z"),
      timezone: "UTC",
      cat: makeCat({ birthDate: "2025-09-11" }),
      settings: allEnabledSettings,
      latestShampooAt: new Date("2026-07-11T00:00:00.000Z"),
      latestWeightAt: new Date("2026-08-28T00:00:00.000Z"),
      cleaningTargets: [],
      openSymptoms: [longOngoingSymptom],
    });

    expect(candidates).toEqual([]);
  });

  it("18:00 より前でも、通知時刻を過ぎた掃除対象の通知は生成する", () => {
    const candidates = evaluateNotificationRules({
      now: new Date("2026-09-11T08:00:00.000Z"),
      timezone: "UTC",
      cat: makeCat({ birthDate: "2025-09-11" }),
      settings: allEnabledSettings,
      latestShampooAt: null,
      latestWeightAt: null,
      cleaningTargets: [
        {
          target: {
            id: "target-1",
            catId: "cat-1",
            name: "水",
            frequencyValue: 1,
            frequencyUnit: "days",
            notifyTime: "08:00",
            isActive: true,
            sortOrder: 0,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          lastPerformedAt: new Date("2026-09-10T08:30:00.000Z"),
          nextDueAt: new Date("2026-09-11T08:00:00.000Z"),
          isOverdue: false,
        },
      ],
      openSymptoms: [longOngoingSymptom],
    });

    expect(candidates.map((c) => c.kind)).toEqual(["cleaning_due"]);
  });

  it("1ヶ月以上解消していない症状があれば、18:00 以降に確認の通知を返す", () => {
    const candidates = evaluateNotificationRules({
      now: new Date("2026-09-11T18:00:00.000Z"),
      timezone: "UTC",
      cat: makeCat({ birthDate: null }),
      settings: allEnabledSettings,
      latestShampooAt: null,
      latestWeightAt: null,
      cleaningTargets: [],
      openSymptoms: [longOngoingSymptom],
    });

    expect(candidates.map((c) => c.kind)).toEqual(["symptom_ongoing"]);
  });

  it("症状の確認通知を無効にすると生成されない", () => {
    const candidates = evaluateNotificationRules({
      now: new Date("2026-09-11T18:00:00.000Z"),
      timezone: "UTC",
      cat: makeCat({ birthDate: null }),
      settings: { ...allEnabledSettings, symptomOngoing: { isEnabled: false } },
      latestShampooAt: null,
      latestWeightAt: null,
      cleaningTargets: [],
      openSymptoms: [longOngoingSymptom],
    });

    expect(candidates).toEqual([]);
  });
});
