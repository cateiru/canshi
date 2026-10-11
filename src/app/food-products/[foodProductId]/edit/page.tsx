import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { updateFoodProductAction } from "@/features/food-products/actions";
import { FoodProductForm } from "@/features/food-products/FoodProductForm";
import { FOOD_PRODUCT_MEDIA_TYPE } from "@/features/food-products/media";
import { getFoodProductForUser } from "@/features/food-products/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import { listMediaAssetsByRecord } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditFoodProductPageProps = {
  params: Promise<{ foodProductId: string }>;
};

export default async function EditFoodProductPage({
  params,
}: EditFoodProductPageProps) {
  const { foodProductId } = await params;
  const user = await requireUser();
  // 別の家の商品は、存在しない商品と区別せずに 404 にする
  const foodProduct = await getFoodProductForUser(user.id, foodProductId);

  if (!foodProduct) {
    notFound();
  }

  const mediaAssets = await listMediaAssetsByRecord(
    FOOD_PRODUCT_MEDIA_TYPE,
    foodProduct.id,
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "ごはん商品一覧", href: "/food-products" },
          { label: "編集する" },
        ]}
      />

      <h1>{foodProduct.name}を編集する</h1>
      <FoodProductForm
        action={updateFoodProductAction.bind(null, foodProduct.id)}
        foodProduct={foodProduct}
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
