import { getCurrentUser } from "@/features/auth/presentation/session";
import { canAccessMediaAsset } from "@/features/media/application/access";
import { THUMBNAIL_MIME_TYPE } from "@/features/media/domain/mimeSniff";
import { getMediaAssetById } from "@/features/media/infrastructure/queries";
import { serveR2Object } from "@/features/media/infrastructure/serve";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ assetId: string }>;
};

/** サムネイルの配信 */
export async function GET(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { assetId } = await params;
  const asset = await getMediaAssetById(assetId);
  // 別の家の猫のメディアは存在を明かさないよう 404 にする
  if (
    !asset?.thumbnailObjectKey ||
    !(await canAccessMediaAsset(user.id, asset))
  ) {
    return new Response("Not Found", { status: 404 });
  }
  return serveR2Object(request, asset.thumbnailObjectKey, THUMBNAIL_MIME_TYPE);
}
