import { getCurrentUser } from "@/features/auth/presentation/session";
import { getHouseholdForUser } from "@/features/households/infrastructure/queries";
import { recordExportFileName } from "@/features/record-exports/domain/recordExport";
import { getRecordExport } from "@/features/record-exports/infrastructure/queries";
import { getRecordExportObject } from "@/features/record-exports/infrastructure/storage";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ householdId: string; recordExportId: string }>;
};

/** 出力した zip をダウンロードする。家のメンバーなら誰でもダウンロードできる */
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { householdId, recordExportId } = await params;
  // 所属していない家の出力・作り終えていない出力は、存在を明かさないよう 404 にする
  if (!(await getHouseholdForUser(user.id, householdId))) {
    return new Response("Not Found", { status: 404 });
  }
  const recordExport = await getRecordExport(householdId, recordExportId);
  if (recordExport?.status !== "completed" || !recordExport.objectKey) {
    return new Response("Not Found", { status: 404 });
  }
  const object = await getRecordExportObject(recordExport.objectKey);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  headers.set("Content-Length", String(object.size));
  headers.set(
    "Content-Disposition",
    `attachment; filename="${recordExportFileName(recordExport.createdAt)}"`,
  );
  // 家のメンバーごとに見られる出力が違うため、共有キャッシュには載せない
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { status: 200, headers });
}
