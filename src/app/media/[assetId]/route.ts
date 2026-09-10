import { getMediaAssetById } from "@/features/media/queries";
import { serveR2Object } from "@/features/media/serve";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ assetId: string }>;
};

/** 元データの配信 */
export async function GET(request: Request, { params }: RouteContext) {
  const { assetId } = await params;
  const asset = await getMediaAssetById(assetId);
  if (!asset) {
    return new Response("Not Found", { status: 404 });
  }
  return serveR2Object(request, asset.objectKey, asset.mimeType);
}
