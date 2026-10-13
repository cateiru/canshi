"use server";

import { revalidatePath } from "next/cache";
import { requireHouseholdAccess } from "@/features/auth/session";
import type { HouseholdMemberActionResult } from "@/features/households/actions";
import {
  createFeedingSchedule,
  deleteFeedingSchedule,
  updateFeedingScheduleNotify,
} from "./mutations";
import {
  type FeedingScheduleFormFieldErrors,
  feedingScheduleFormSchema,
  feedingScheduleNotifyFormSchema,
} from "./schema";

export type FeedingScheduleFormState = {
  fieldErrors?: FeedingScheduleFormFieldErrors;
  formError?: string;
  /** 保存に成功したときに、フォームの下に表示するメッセージ */
  message?: string;
};

function feedingSchedulesPath(householdId: string) {
  return `/settings/households/${householdId}/feeding-schedules`;
}

/** 家にごはんの時間を追加する。追加後も同じページにとどまり、一覧を表示し直す */
export async function createFeedingScheduleAction(
  householdId: string,
  _prevState: FeedingScheduleFormState,
  formData: FormData,
): Promise<FeedingScheduleFormState> {
  const { user } = await requireHouseholdAccess(householdId);
  const parsed = feedingScheduleFormSchema.safeParse({
    time: formData.get("time"),
    notifyAtTime: formData.get("notifyAtTime"),
    remindIfNotRecorded: formData.get("remindIfNotRecorded"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const result = await createFeedingSchedule(householdId, user.id, parsed.data);
  if (!result.ok) {
    return { formError: result.error };
  }

  revalidatePath(feedingSchedulesPath(householdId));
  return { message: `${parsed.data.time}を追加しました` };
}

/** ごはんの時間の通知の設定を保存する */
export async function updateFeedingScheduleNotifyAction(
  householdId: string,
  scheduleId: string,
  _prevState: FeedingScheduleFormState,
  formData: FormData,
): Promise<FeedingScheduleFormState> {
  const { user } = await requireHouseholdAccess(householdId);
  const parsed = feedingScheduleNotifyFormSchema.safeParse({
    notifyAtTime: formData.get("notifyAtTime"),
    remindIfNotRecorded: formData.get("remindIfNotRecorded"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const result = await updateFeedingScheduleNotify(
    householdId,
    user.id,
    scheduleId,
    parsed.data,
  );
  if (!result.ok) {
    return { formError: result.error };
  }

  revalidatePath(feedingSchedulesPath(householdId));
  return { message: "保存しました" };
}

/** ごはんの時間を削除する */
export async function deleteFeedingScheduleAction(
  householdId: string,
  scheduleId: string,
): Promise<HouseholdMemberActionResult> {
  const { user } = await requireHouseholdAccess(householdId);
  const result = await deleteFeedingSchedule(householdId, user.id, scheduleId);
  return result.ok ? {} : { error: result.error };
}
