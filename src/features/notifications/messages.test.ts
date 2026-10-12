import { describe, expect, it } from "vitest";
import {
  buildHouseholdNotificationMessage,
  buildNotificationMessage,
} from "./messages";
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

  it("symptom_ongoing の文言を組み立てる", () => {
    const candidate: NotificationCandidate = {
      ...base,
      kind: "symptom_ongoing",
      referenceId: "symptom-1",
      symptomId: "symptom-1",
      symptomType: "くしゃみ",
      status: "improving",
      elapsedMonths: 2,
    };
    expect(buildNotificationMessage("たま", candidate)).toEqual({
      title: "たまの「くしゃみ」は解消しましたか？",
      body: "「くしゃみ」の症状が「改善中」のまま2ヶ月が経過しました",
      url: "/cats/cat-1/symptoms/symptom-1/edit",
    });
  });
});

describe("buildHouseholdNotificationMessage", () => {
  const base = {
    householdId: "household-1",
    referenceId: "schedule-1",
    dedupeKey: "dedupe",
    dueAt: new Date("2026-09-11T07:00:00.000Z"),
    time: "07:00",
    recordWindow: {
      start: new Date("2026-09-11T01:00:00.000Z"),
      end: new Date("2026-09-11T13:00:00.000Z"),
    },
  };

  it("feeding_time の文言を組み立て、猫が 1 匹ならその猫の記録画面へ遷移する", () => {
    expect(
      buildHouseholdNotificationMessage({ ...base, kind: "feeding_time" }, [
        "cat-1",
      ]),
    ).toEqual({
      title: "ごはんの時間です",
      body: "07:00のごはんの時間になりました。ごはんをあげたら記録しておきましょう",
      url: "/cats/cat-1/feeding-records/new",
    });
  });

  it("feeding_not_recorded の文言を組み立て、猫が複数なら猫一覧へ遷移する", () => {
    expect(
      buildHouseholdNotificationMessage(
        { ...base, kind: "feeding_not_recorded", time: "19:00" },
        ["cat-1", "cat-2"],
      ),
    ).toEqual({
      title: "ごはんはあげましたか？",
      body: "19:00のごはんの記録がありません。あげていたら記録しておきましょう",
      url: "/cats",
    });
  });
});
