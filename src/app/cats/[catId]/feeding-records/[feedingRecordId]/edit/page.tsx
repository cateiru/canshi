import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { FeedingIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { listFeedingPresets } from "@/features/feeding-presets/infrastructure/queries";
import {
  getFeedingRecordById,
  listRecentlyUsedFoodProductIds,
} from "@/features/feeding-records/infrastructure/queries";
import { updateFeedingRecordAction } from "@/features/feeding-records/presentation/actions";
import { FeedingRecordForm } from "@/features/feeding-records/presentation/FeedingRecordForm";
import {
  listFoodProductImageUrls,
  listFoodProducts,
} from "@/features/food-products/infrastructure/queries";
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

  const [foodProducts, recentlyUsedFoodProductIds, presets] = await Promise.all(
    [
      listFoodProducts(cat.householdId),
      listRecentlyUsedFoodProductIds(catId, cat.householdId),
      listFeedingPresets(cat.householdId),
    ],
  );
  const foodProductImageUrls = await listFoodProductImageUrls(
    foodProducts.map((foodProduct) => foodProduct.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
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
