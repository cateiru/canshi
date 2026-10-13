import { redirect } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { resolveHouseholdFeedingRecordPath } from "@/features/feeding-schedules/feedingRecordPath";
import { listCatsForUser } from "@/features/households/queries";

export const dynamic = "force-dynamic";

type HouseholdFeedingRecordPageProps = {
  params: Promise<{ householdId: string }>;
};

/**
 * 家についてのごはんの通知から開く画面。家の今の猫が 1 匹ならその猫のごはん記録の追加画面へ、
 * それ以外（複数いる・いない・家のメンバーでない）なら猫一覧へ移動する
 */
export default async function HouseholdFeedingRecordPage({
  params,
}: HouseholdFeedingRecordPageProps) {
  const { householdId } = await params;
  const user = await requireUser();
  const catIds = (await listCatsForUser(user.id))
    .filter((cat) => cat.householdId === householdId)
    .map((cat) => cat.id);
  redirect(resolveHouseholdFeedingRecordPath(catIds));
}
