import { describe, expect, it } from "vitest";
import { isPeriodEnded, medicationPeriod } from "./medicationPeriod";

describe("MedicationPeriod", () => {
  it("終了予定日がなければ終わらない", () => {
    const period = medicationPeriod("2026-01-01", undefined);
    expect(period.endDate).toBeNull();
    expect(isPeriodEnded(period, "2030-01-01")).toBe(false);
  });

  it("終了予定日の当日はまだ服用中で、翌日から終了", () => {
    const period = medicationPeriod("2026-01-01", "2026-01-10");
    expect(isPeriodEnded(period, "2026-01-10")).toBe(false);
    expect(isPeriodEnded(period, "2026-01-11")).toBe(true);
  });
});
