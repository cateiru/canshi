import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { updateFeedingPresetAction } from "@/features/feeding-presets/actions";
import { FeedingPresetForm } from "@/features/feeding-presets/FeedingPresetForm";
import { getFeedingPresetById } from "@/features/feeding-presets/queries";
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
  const [preset, foodProducts] = await Promise.all([
    getFeedingPresetById(presetId),
    listFoodProducts(),
  ]);

  if (!preset) {
    notFound();
  }

  const foodProductImageUrls = await listFoodProductImageUrls(
    foodProducts.map((foodProduct) => foodProduct.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
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
