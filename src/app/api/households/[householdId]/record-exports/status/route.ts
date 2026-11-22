import { getCurrentUser } from "@/features/auth/presentation/session";
import { getHouseholdForUser } from "@/features/households/infrastructure/queries";
import { hasRunningRecordExport } from "@/features/record-exports/infrastructure/queries";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ householdId: string }>;
};

/**
 * 家に処理中の記録の出力があるか（`{ running: boolean }`）。出力のページが、処理中の間だけ
 * 1 秒ごとに呼ぶ（`RecordExportPolling`）
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "ログインしてください" }, { status: 401 });
  }
  const { householdId } = await params;
  // 所属していない家は、存在を明かさないよう 404 にする
  if (!(await getHouseholdForUser(user.id, householdId))) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }
  const running = await hasRunningRecordExport(householdId, new Date());
  return Response.json(
    { running },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
