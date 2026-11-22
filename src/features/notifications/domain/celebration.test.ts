import { describe, expect, it } from "vitest";
import { NOTIFICATION_KINDS } from "@/db/schema";
import { isCelebrationNotificationKind } from "./celebration";

describe("isCelebrationNotificationKind", () => {
  it("誕生日・半年ごとの節目・生後100日ごとの節目をお祝いの通知とする", () => {
    expect(
      NOTIFICATION_KINDS.filter((kind) => isCelebrationNotificationKind(kind)),
    ).toEqual(["birthday_yearly", "birthday_half_year", "days_milestone"]);
  });
});
