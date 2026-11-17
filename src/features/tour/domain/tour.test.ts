import { describe, expect, it } from "vitest";
import {
  canLeaveTourStep,
  EMPTY_TOUR_PROGRESS,
  effectiveTourPosition,
  encodeTourCookie,
  isTourHiddenPath,
  isTourStepDone,
  isTourStepPage,
  nextTourPosition,
  parseTourCookie,
  parseTourPosition,
  resumeTourPosition,
  shouldStartTourOnLogin,
  type TourProgress,
  tourStepHref,
} from "./tour";

const ALL_DONE: TourProgress = {
  household: true,
  cat: true,
  food: true,
  schedule: true,
  preset: true,
};

describe("parseTourPosition", () => {
  it("ステップと done だけを受け付ける", () => {
    expect(parseTourPosition("household")).toBe("household");
    expect(parseTourPosition("feeding")).toBe("feeding");
    expect(parseTourPosition("done")).toBe("done");
    expect(parseTourPosition("unknown")).toBeNull();
    expect(parseTourPosition(undefined)).toBeNull();
  });
});

describe("parseTourCookie", () => {
  it("ログイン中のユーザーの Cookie だけを読む", () => {
    const value = encodeTourCookie("user-1", "food");
    expect(parseTourCookie(value, "user-1")).toBe("food");
    expect(parseTourCookie(value, "user-2")).toBeNull();
  });

  it("ユーザーの ID がない古い形式・知らない値は読まない", () => {
    expect(parseTourCookie("food", "user-1")).toBeNull();
    expect(parseTourCookie("user-1:unknown", "user-1")).toBeNull();
    expect(parseTourCookie(undefined, "user-1")).toBeNull();
  });
});

describe("isTourStepDone", () => {
  it("ごはんの時間・プリセットは、どちらかがあれば登録済みにする", () => {
    expect(isTourStepDone("feeding", EMPTY_TOUR_PROGRESS)).toBe(false);
    expect(
      isTourStepDone("feeding", { ...EMPTY_TOUR_PROGRESS, schedule: true }),
    ).toBe(true);
    expect(
      isTourStepDone("feeding", { ...EMPTY_TOUR_PROGRESS, preset: true }),
    ).toBe(true);
  });

  it("ほかのステップは、そのステップのものがあれば登録済みにする", () => {
    expect(isTourStepDone("cat", EMPTY_TOUR_PROGRESS)).toBe(false);
    expect(isTourStepDone("cat", { ...EMPTY_TOUR_PROGRESS, cat: true })).toBe(
      true,
    );
  });
});

describe("canLeaveTourStep", () => {
  it("家の作成は飛ばせない", () => {
    expect(canLeaveTourStep("household", EMPTY_TOUR_PROGRESS)).toBe(false);
    expect(
      canLeaveTourStep("household", {
        ...EMPTY_TOUR_PROGRESS,
        household: true,
      }),
    ).toBe(true);
  });

  it("ほかのステップは登録しなくても進める", () => {
    const progress = { ...EMPTY_TOUR_PROGRESS, household: true };
    expect(canLeaveTourStep("cat", progress)).toBe(true);
    expect(canLeaveTourStep("food", progress)).toBe(true);
    expect(canLeaveTourStep("feeding", progress)).toBe(true);
  });
});

describe("nextTourPosition", () => {
  it("家 → ねこ → ごはん → ごはんの時間・プリセット → 完了の順に進む", () => {
    expect(nextTourPosition("household")).toBe("cat");
    expect(nextTourPosition("cat")).toBe("food");
    expect(nextTourPosition("food")).toBe("feeding");
    expect(nextTourPosition("feeding")).toBe("done");
  });
});

describe("resumeTourPosition", () => {
  it("まだ登録していない最初のステップから再開する", () => {
    expect(resumeTourPosition(EMPTY_TOUR_PROGRESS)).toBe("household");
    expect(
      resumeTourPosition({ ...EMPTY_TOUR_PROGRESS, household: true }),
    ).toBe("cat");
    expect(resumeTourPosition({ ...ALL_DONE, food: false })).toBe("food");
  });

  it("すべて登録済みなら最初から案内する", () => {
    expect(resumeTourPosition(ALL_DONE)).toBe("household");
  });
});

describe("effectiveTourPosition", () => {
  it("家がなければ家の作成を案内する", () => {
    expect(effectiveTourPosition("food", EMPTY_TOUR_PROGRESS)).toBe(
      "household",
    );
    expect(effectiveTourPosition("food", ALL_DONE)).toBe("food");
    expect(effectiveTourPosition("done", EMPTY_TOUR_PROGRESS)).toBe("done");
  });
});

describe("tourStepHref", () => {
  it("登録画面で家を最初から選んでおく", () => {
    expect(tourStepHref("household", null)).toBe("/settings/households/new");
    expect(tourStepHref("cat", "h1")).toBe("/cats/new?householdId=h1");
    expect(tourStepHref("food", "h1")).toBe(
      "/food-products/add?householdId=h1",
    );
    expect(tourStepHref("feeding", "h1")).toBe(
      "/settings/households/h1/feeding-schedules",
    );
  });
});

describe("isTourStepPage", () => {
  it("ステップの登録画面かどうかを判定する", () => {
    expect(isTourStepPage("household", "/settings/households/new")).toBe(true);
    expect(isTourStepPage("household", "/settings/households")).toBe(false);
    expect(isTourStepPage("cat", "/cats/new")).toBe(true);
    expect(isTourStepPage("food", "/food-products/search")).toBe(true);
    expect(isTourStepPage("food", "/food-products")).toBe(false);
    expect(
      isTourStepPage("feeding", "/settings/households/h1/feeding-schedules"),
    ).toBe(true);
    expect(isTourStepPage("feeding", "/feeding-presets/new")).toBe(true);
  });
});

describe("isTourHiddenPath", () => {
  it("ログイン・AI との接続の許可・招待のページでは出さない", () => {
    expect(isTourHiddenPath("/login")).toBe(true);
    expect(isTourHiddenPath("/oauth/authorize")).toBe(true);
    expect(isTourHiddenPath("/invitations/token")).toBe(true);
    expect(isTourHiddenPath("/cats")).toBe(false);
  });
});

describe("shouldStartTourOnLogin", () => {
  it("はじめてログインしたときにはじめる", () => {
    expect(shouldStartTourOnLogin(true, "/")).toBe(true);
    expect(shouldStartTourOnLogin(false, "/")).toBe(false);
  });

  it("招待 URL から来たときははじめない", () => {
    expect(shouldStartTourOnLogin(true, "/invitations/token")).toBe(false);
  });
});
