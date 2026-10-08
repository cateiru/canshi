import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { updateFeedingPresetAction } from "@/features/feeding-presets/actions";
import { FeedingPresetForm } from "@/features/feeding-presets/FeedingPresetForm";
import { getFeedingPresetForUser } from "@/features/feeding-presets/queries";
import {
  listFoodProductImageUrls,
  listFoodProducts,
} from "@/features/food-products/queries";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditFeedingPresetPageProps = {
  params: Promise<{ presetId: string }>;
};

export default async function EditFeedingPresetPage({
  params,
}: EditFeedingPresetPageProps) {
  const { presetId } = await params;
  const user = await requireUser();
  // 別の家のプリセットは、存在しないプリセットと区別せずに 404 にする
  const preset = await getFeedingPresetForUser(user.id, presetId);

  if (!preset) {
    notFound();
  }

  // 明細はプリセットと同じ家の商品から選ぶ
  const foodProducts = await listFoodProducts(preset.householdId);

  const foodProductImageUrls = await listFoodProductImageUrls(
    foodProducts.map((foodProduct) => foodProduct.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "ごはんプリセット一覧", href: "/feeding-presets" },
          { label: "編集する" },
        ]}
      />

      <h1>ごはんプリセットを編集する</h1>
      <FeedingPresetForm
        action={updateFeedingPresetAction.bind(null, preset.id)}
        foodProducts={foodProducts}
        foodProductImageUrls={foodProductImageUrls}
        preset={preset}
        submitLabel="更新する"
      />
    </main>
  );
}
