import { describe, expect, it } from "vitest";
import {
  getMedicationToday,
  isMedicationInHistory,
  partitionMedications,
} from "./history";

const TODAY = "2026-10-19";

function medication(
  id: string,
  fields: { endDate?: string | null; archivedAt?: Date | null } = {},
) {
  return {
    id,
    endDate: fields.endDate ?? null,
    archivedAt: fields.archivedAt ?? null,
  };
}

describe("getMedicationToday", () => {
  it("JST の日付を返す（UTC では前日の 0〜9 時でも JST の日付になる）", () => {
    // 2026-10-19 00:30 JST = 2026-10-18 15:30 UTC
    expect(getMedicationToday(new Date("2026-10-18T15:30:00Z"))).toBe(
      "2026-10-19",
    );
  });
});

describe("isMedicationInHistory", () => {
  it("終了予定日がなく、手動で移していなければ服用中", () => {
    expect(isMedicationInHistory(medication("a"), TODAY)).toBe(false);
  });

  it("終了予定日の当日はまだ服用中", () => {
    expect(
      isMedicationInHistory(medication("a", { endDate: TODAY }), TODAY),
    ).toBe(false);
  });

  it("終了予定日を過ぎていれば服薬歴", () => {
    expect(
      isMedicationInHistory(medication("a", { endDate: "2026-10-18" }), TODAY),
    ).toBe(true);
  });

  it("手動で服薬歴に移していれば、終了予定日の前でも服薬歴", () => {
    expect(
      isMedicationInHistory(
        medication("a", {
          endDate: "2026-12-31",
          archivedAt: new Date("2026-10-19T08:00:00Z"),
        }),
        TODAY,
      ),
    ).toBe(true);
  });
});

describe("partitionMedications", () => {
  it("服用中は渡された順のまま、服薬歴は服薬歴に移った日の新しい順に並べる", () => {
    const { current, history } = partitionMedications(
      [
        medication("current-1"),
        medication("ended-old", { endDate: "2026-09-01" }),
        medication("current-2", { endDate: TODAY }),
        medication("archived", {
          archivedAt: new Date("2026-10-10T08:00:00Z"),
        }),
        medication("ended-new", { endDate: "2026-10-15" }),
        // 終了予定日より前に手動で移したものは、移した日で並べる
        medication("archived-early", {
          endDate: "2026-10-18",
          archivedAt: new Date("2026-09-20T08:00:00Z"),
        }),
      ],
      TODAY,
    );

    expect(current.map((m) => m.id)).toEqual(["current-1", "current-2"]);
    expect(history.map((m) => m.id)).toEqual([
      "ended-new",
      "archived",
      "archived-early",
      "ended-old",
    ]);
  });
});
