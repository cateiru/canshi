import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { FeedingIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/session";
import { listFeedingPresets } from "@/features/feeding-presets/queries";
import { updateFeedingRecordAction } from "@/features/feeding-records/actions";
import { FeedingRecordForm } from "@/features/feeding-records/FeedingRecordForm";
import {
  getFeedingRecordById,
  listFoodProductsOfFeedingRecord,
  listRecentlyUsedFoodProductIds,
} from "@/features/feeding-records/queries";
import {
  listFoodProductImageUrls,
  listFoodProducts,
} from "@/features/food-products/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
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
    getAccessibleCat(catId),
    getFeedingRecordById(feedingRecordId),
  ]);

  if (!cat?.householdId || !feedingRecord || feedingRecord.catId !== catId) {
    notFound();
  }

  const [
    householdFoodProducts,
    recordFoodProducts,
    recentlyUsedFoodProductIds,
    presets,
  ] = await Promise.all([
    listFoodProducts(cat.householdId),
    listFoodProductsOfFeedingRecord(feedingRecord.id),
    listRecentlyUsedFoodProductIds(catId, cat.householdId),
    listFeedingPresets(cat.householdId),
  ]);
  // 猫が別の家へ引っ越す前の記録は元の家の商品を使っているため、その商品も選択肢に残す
  const foodProducts = [
    ...householdFoodProducts,
    ...recordFoodProducts.filter(
      (recordFoodProduct) =>
        !householdFoodProducts.some(
          (foodProduct) => foodProduct.id === recordFoodProduct.id,
        ),
    ),
  ];
  const foodProductImageUrls = await listFoodProductImageUrls(
    foodProducts.map((foodProduct) => foodProduct.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "ごはん記録", href: `/cats/${catId}/feeding-records` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={FeedingIcon}>
        {cat.name}のごはん記録を編集する
      </RecordPageHeading>
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
