"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/presentation/session";
import {
  canLeaveTourStep,
  effectiveTourPosition,
  isTourStepDone,
  nextTourPosition,
  resumeTourPosition,
  TOUR_COOKIE_NAME,
  type TourStep,
  type TourView,
  tourStepHref,
} from "../domain/tour";
import {
  getTourView,
  loadTourProgress,
  readTourPosition,
  writeTourPosition,
} from "./tourState";

/**
 * ガイドをはじめる（ヘルプから再開する）。まだ登録していない最初のステップから案内し、
 * その登録画面へ移る。すべて登録済みなら、今のページのまま最初のステップから案内する
 */
export async function startTourAction(): Promise<void> {
  const user = await requireUser();
  const { householdId, progress } = await loadTourProgress(user.id);
  const step = resumeTourPosition(progress);
  await writeTourPosition(user.id, step);
  if (!isTourStepDone(step, progress)) {
    redirect(tourStepHref(step, householdId));
  }
}

/**
 * ガイドを次のステップへ進める（登録を終えたとき・スキップするとき）。次のステップがまだ登録されて
 * いなければ、その登録画面へ移る。`from` は押したときに表示していたステップで、二重に押しても
 * 1 つしか進まないよう、今の位置と同じときだけ進める。家がないうちは、家の作成から先へ進めない
 */
export async function advanceTourAction(from: TourStep): Promise<void> {
  const user = await requireUser();
  const position = await readTourPosition(user.id);
  if (!position) {
    return;
  }
  const { householdId, progress } = await loadTourProgress(user.id);
  if (
    effectiveTourPosition(position, progress) !== from ||
    !canLeaveTourStep(from, progress)
  ) {
    return;
  }

  const next = nextTourPosition(from);
  await writeTourPosition(user.id, next);
  if (next !== "done" && !isTourStepDone(next, progress)) {
    redirect(tourStepHref(next, householdId));
  }
}

/** ガイドをやめる（完了の案内を閉じるときも同じ）。ヘルプからいつでもはじめ直せる */
export async function quitTourAction(): Promise<void> {
  await requireUser();
  (await cookies()).delete(TOUR_COOKIE_NAME);
}

/**
 * ガイドのパネルの状態を読み直す。登録を終えて別のページへ移ったときに、パネルを登録済みの表示へ
 * 変えるために、パネル（クライアント）がページの移動のたびに呼ぶ
 */
export async function getTourViewAction(): Promise<TourView | null> {
  return getTourView();
}
