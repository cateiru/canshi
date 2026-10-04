import { getCurrentUser } from "@/features/auth/session";
import { canAccessMediaAsset } from "@/features/media/access";
import { getMediaAssetById } from "@/features/media/queries";
import { serveR2Object } from "@/features/media/serve";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ assetId: string }>;
};

/** 元データの配信 */
export async function GET(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { assetId } = await params;
  const asset = await getMediaAssetById(assetId);
  // 別の家の猫のメディアは存在を明かさないよう 404 にする
  if (!asset || !(await canAccessMediaAsset(user.id, asset))) {
    return new Response("Not Found", { status: 404 });
  }
  return serveR2Object(request, asset.objectKey, asset.mimeType);
}
