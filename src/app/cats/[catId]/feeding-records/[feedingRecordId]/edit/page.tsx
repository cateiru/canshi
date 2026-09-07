import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
import { updateFeedingRecordAction } from "@/features/feeding-records/actions";
import { FeedingRecordForm } from "@/features/feeding-records/FeedingRecordForm";
import {
  getFeedingRecordById,
  listRecentlyUsedFoodProductIds,
} from "@/features/feeding-records/queries";
import { listFoodProducts } from "@/features/food-products/queries";
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

  const [foodProducts, recentlyUsedFoodProductIds] = await Promise.all([
    listFoodProducts(),
    listRecentlyUsedFoodProductIds(catId),
  ]);

  return (
    <main className={styles.main}>
      <h1>{cat.name}の給餌記録を編集する</h1>
      <FeedingRecordForm
        action={updateFeedingRecordAction.bind(null, catId, feedingRecord.id)}
        foodProducts={foodProducts}
        recentlyUsedFoodProductIds={recentlyUsedFoodProductIds}
        feedingRecord={feedingRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
