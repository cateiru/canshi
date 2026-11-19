/*
 * はじめてガイド（初回ログインしたユーザー向けのガイドツアー）。家の作成 → ねこの登録 → ごはんの登録 →
 * ごはんの時間・プリセットの登録の順に、既存の登録画面へ案内する。
 * はじめてログインしたときは、ガイドの前にウェルカムモーダル（`welcome`）を出し、招待 URL を
 * 持っていれば招待のページへ、持っていなければガイドへ進める。
 *
 * どこまで進んだかはこの端末の Cookie にだけ持ち、DB には保存しない。各ステップの登録が済んでいるかは、
 * 表示のたびに家のデータから求める（`TourProgress`）。
 * 同じブラウザで別のユーザーに切り替えても前のユーザーのガイドが出ないよう、Cookie にはガイドを
 * はじめたユーザーの ID も持ち、ログイン中のユーザーと違えば読まない（`parseTourCookie`）
 */

/** ガイドの位置を保存する Cookie の名前。Cookie がなければガイドは表示しない */
export const TOUR_COOKIE_NAME = "canshi-tour";

/** ガイドの Cookie の有効期間。途中のまま放置されたガイドは、30 日で表示をやめる */
export const TOUR_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** ガイドのステップ。この順に案内する */
export const TOUR_STEPS = ["household", "cat", "food", "feeding"] as const;

export type TourStep = (typeof TOUR_STEPS)[number];

/** ガイドの位置。`done` はすべてのステップを終えて、完了の案内を出している状態 */
export type TourPosition = TourStep | "done";

/** ウェルカムモーダルを出している状態。招待 URL を持っているかを選ぶまで、ガイドははじめない */
export const TOUR_WELCOME = "welcome";

/** ガイドの Cookie に保存する状態。ウェルカムモーダルか、ガイドの位置 */
export type TourCookieState = TourPosition | typeof TOUR_WELCOME;

/** 各ステップで登録するものが、すでにあるか */
export type TourProgress = {
  household: boolean;
  cat: boolean;
  food: boolean;
  schedule: boolean;
  preset: boolean;
};

/** ガイドのパネルの表示に使う状態 */
export type TourView = {
  position: TourPosition;
  /** 案内する登録画面で最初から選んでおく家（ユーザーが最初に所属した家）。家がなければ null */
  householdId: string | null;
  progress: TourProgress;
};

export const EMPTY_TOUR_PROGRESS: TourProgress = {
  household: false,
  cat: false,
  food: false,
  schedule: false,
  preset: false,
};

/** Cookie の値。ガイドをはじめたユーザーの ID と、ガイドの位置（またはウェルカムモーダル）をつなげる */
export function encodeTourCookie(userId: string, state: TourCookieState) {
  return `${userId}:${state}`;
}

/**
 * Cookie の値から、ログイン中のユーザーのガイドの状態を読む。別のユーザーの Cookie・知らない値は
 * null（ガイドもウェルカムモーダルも表示しない）
 */
export function parseTourCookie(
  value: unknown,
  userId: string,
): TourCookieState | null {
  if (typeof value !== "string") {
    return null;
  }
  const separator = value.lastIndexOf(":");
  if (separator === -1 || value.slice(0, separator) !== userId) {
    return null;
  }
  const state = value.slice(separator + 1);
  return state === TOUR_WELCOME ? state : parseTourPosition(state);
}

/** ガイドの位置の文字列を読む。知らない値は null */
export function parseTourPosition(value: unknown): TourPosition | null {
  if (value === "done") {
    return value;
  }
  return TOUR_STEPS.find((step) => step === value) ?? null;
}

/** ステップで登録するものが 1 つでもあるか（ごはんの時間・プリセットはどちらかがあればよい） */
export function isTourStepDone(step: TourStep, progress: TourProgress) {
  return step === "feeding"
    ? progress.schedule || progress.preset
    : progress[step];
}

/**
 * ステップを終えて次へ進めるか。ねこ・ごはんの登録には家が必要なため、家の作成だけは飛ばせない。
 * ほかのステップは、登録しなくても次へ進める（スキップ）
 */
export function canLeaveTourStep(step: TourStep, progress: TourProgress) {
  return step !== "household" || progress.household;
}

/** 次のステップ。最後のステップの次は `done` */
export function nextTourPosition(step: TourStep): TourPosition {
  return TOUR_STEPS[TOUR_STEPS.indexOf(step) + 1] ?? "done";
}

/**
 * すべてのステップの登録が済んでいるか。済んでいれば、ヘルプにガイドをはじめる欄を出さない
 * （`TourStartCard`）
 */
export function isTourComplete(progress: TourProgress) {
  return TOUR_STEPS.every((step) => isTourStepDone(step, progress));
}

/**
 * ヘルプからガイドをはじめる（再開する）ときの位置。まだ登録していない最初のステップから案内する。
 * すべて登録済みのときはヘルプにはじめる欄を出さないが、古い画面から送られたときに備えて最初から案内する
 */
export function resumeTourPosition(progress: TourProgress): TourStep {
  return (
    TOUR_STEPS.find((step) => !isTourStepDone(step, progress)) ?? TOUR_STEPS[0]
  );
}

/**
 * 表示する位置。家がなければ、Cookie の位置によらず家の作成を案内する
 * （ガイドの途中で家を削除した・家から外されたとき）
 */
export function effectiveTourPosition(
  position: TourPosition,
  progress: TourProgress,
): TourPosition {
  return position !== "done" && !progress.household ? "household" : position;
}

function withHousehold(path: string, householdId: string | null) {
  return householdId
    ? `${path}?householdId=${encodeURIComponent(householdId)}`
    : path;
}

/** ごはんの時間の登録画面。家ごとのページのため、家がなければ家の一覧を案内する */
export function tourScheduleHref(householdId: string | null) {
  return householdId
    ? `/settings/households/${encodeURIComponent(householdId)}/feeding-schedules`
    : "/settings/households";
}

/** ごはんプリセットの登録画面 */
export function tourPresetHref(householdId: string | null) {
  return withHousehold("/feeding-presets/new", householdId);
}

/** ステップで案内する登録画面。家を最初から選んでおく */
export function tourStepHref(step: TourStep, householdId: string | null) {
  switch (step) {
    case "household":
      return "/settings/households/new";
    case "cat":
      return withHousehold("/cats/new", householdId);
    case "food":
      return withHousehold("/food-products/add", householdId);
    case "feeding":
      return tourScheduleHref(householdId);
  }
}

/**
 * 今のページが、ステップで案内する登録画面か。登録画面ではそこへのリンクを出さず、入力の案内を出す。
 * ごはんの登録は、登録方法の選択・検索・手動の入力のどの画面も登録画面として扱う
 */
export function isTourStepPage(step: TourStep, pathname: string) {
  switch (step) {
    case "household":
      return pathname === "/settings/households/new";
    case "cat":
      return pathname === "/cats/new";
    case "food":
      return [
        "/food-products/add",
        "/food-products/search",
        "/food-products/new",
      ].includes(pathname);
    case "feeding":
      return (
        pathname === "/feeding-presets/new" ||
        /^\/settings\/households\/[^/]+\/feeding-schedules$/.test(pathname)
      );
  }
}

/** ガイドのパネル・ウェルカムモーダルを出さないページ。ほかの操作の途中で、ガイドが邪魔になる画面 */
export function isTourHiddenPath(pathname: string) {
  return ["/login", "/oauth", "/invitations", "/offline"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * ログインしたときにウェルカムモーダルを出すか。はじめてログインした（ユーザーを新しく作った）ときに出し、
 * 招待 URL を持っていなければ、そのままはじめてガイドへ進める。
 * 招待 URL から来たときは、家を作らずに招待された家に参加するため、どちらも出さない
 */
export function shouldWelcomeOnLogin(isNewUser: boolean, callbackUrl: string) {
  return isNewUser && !callbackUrl.startsWith("/invitations/");
}
