import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { listFeedingPresets } from "@/features/feeding-presets/queries";
import { updateFeedingRecordAction } from "@/features/feeding-records/actions";
import { FeedingRecordForm } from "@/features/feeding-records/FeedingRecordForm";
import {
  getFeedingRecordById,
  listRecentlyUsedFoodProductIds,
} from "@/features/feeding-records/queries";
import {
  listFoodProductImageUrls,
  listFoodProducts,
} from "@/features/food-products/queries";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditFeedingRecordPageProps = {
  params: Promise<{ catId: string; feedingRecordId: string }>;
};

export default async function EditFeedingRecordPage({
  params,
}: EditFeedingRecordPageProps) {
  const { catId, feedingRecordId } = await params;
  const [cat, feedingRecord] = await Promise.all([
    getCatById(catId),
    getFeedingRecordById(feedingRecordId),
  ]);

  if (!cat || !feedingRecord || feedingRecord.catId !== catId) {
    notFound();
  }

  const [foodProducts, recentlyUsedFoodProductIds, presets] = await Promise.all(
    [
      listFoodProducts(),
      listRecentlyUsedFoodProductIds(catId),
      listFeedingPresets(),
    ],
  );
  const foodProductImageUrls = await listFoodProductImageUrls(
    foodProducts.map((foodProduct) => foodProduct.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "ごはん記録", href: `/cats/${catId}/feeding-records` },
          { label: "編集する" },
        ]}
      />

      <h1>{cat.name}のごはん記録を編集する</h1>
      <FeedingRecordForm
        action={updateFeedingRecordAction.bind(null, catId, feedingRecord.id)}
        foodProducts={foodProducts}
        foodProductImageUrls={foodProductImageUrls}
        recentlyUsedFoodProductIds={recentlyUsedFoodProductIds}
        presets={presets}
        feedingRecord={feedingRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
