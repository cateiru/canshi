import { describe, expect, it } from "vitest";
import { buildNotificationMessage } from "./messages";
import type { NotificationCandidate } from "./rules";

const base = {
  catId: "cat-1",
  referenceId: null,
  dedupeKey: "cat-1:example",
  dueAt: new Date("2026-09-11T00:00:00.000Z"),
};

describe("buildNotificationMessage", () => {
  it("birthday_yearly の文言を組み立てる", () => {
    const candidate: NotificationCandidate = {
      ...base,
      kind: "birthday_yearly",
      years: 6,
    };
    expect(buildNotificationMessage("たま", candidate)).toEqual({
      title: "たまの6歳の誕生日",
      body: "たまが6歳になりました",
      url: "/cats/cat-1",
    });
  });

  it("shampoo_elapsed の文言を組み立てる", () => {
    const candidate: NotificationCandidate = {
      ...base,
      kind: "shampoo_elapsed",
      elapsedMonths: 2,
    };
    expect(buildNotificationMessage("たま", candidate)).toEqual({
      title: "たまのシャンプーの時期です",
      body: "前回のシャンプーから2ヶ月が経過しました",
      url: "/cats/cat-1/shampoo-records",
    });
  });

  it("cleaning_due の文言を組み立てる", () => {
    const candidate: NotificationCandidate = {
      ...base,
      kind: "cleaning_due",
      referenceId: "target-1",
      targetId: "target-1",
      targetName: "猫砂",
    };
    expect(buildNotificationMessage("たま", candidate)).toEqual({
      title: "猫砂のお手入れの時期です",
      body: "たまの猫砂が予定日を迎えました",
      url: "/cats/cat-1/cleaning/targets/target-1/records",
    });
  });
});
