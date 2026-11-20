import { getCurrentUser } from "@/features/auth/presentation/session";
import { getHouseholdInvitationPreview } from "@/features/households/application/invitations";
import { THUMBNAIL_MIME_TYPE } from "@/features/media/domain/mimeSniff";
import { getMediaAssetById } from "@/features/media/infrastructure/queries";
import { serveR2Object } from "@/features/media/infrastructure/serve";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

/**
 * 招待のページに表示する、招待した人のアイコン画像（サムネイル）の配信。
 * ユーザーのアイコンは同じ家のメンバーにしか見せない（`/media/<id>`）が、招待された人は
 * まだ家に参加していないため、まだ使える招待の URL を持っていることを確かめて見せる
 */
export async function GET(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { token } = await params;
  const preview = await getHouseholdInvitationPreview(token, user.id);
  const assetId =
    preview.status === "valid" ? preview.createdByIconMediaAssetId : null;
  const asset = assetId ? await getMediaAssetById(assetId) : null;
  if (!asset?.thumbnailObjectKey) {
    return new Response("Not Found", { status: 404 });
  }
  const response = await serveR2Object(
    request,
    asset.thumbnailObjectKey,
    THUMBNAIL_MIME_TYPE,
  );
  // 招待の URL にはトークンが含まれるため、ほかのページへ URL を送らない
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
