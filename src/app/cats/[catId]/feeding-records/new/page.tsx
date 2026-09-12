import { notFound } from "next/navigation";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { FeedingIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { listFeedingPresets } from "@/features/feeding-presets/queries";
import { createFeedingRecordAction } from "@/features/feeding-records/actions";
import { FeedingRecordForm } from "@/features/feeding-records/FeedingRecordForm";
import { listRecentlyUsedFoodProductIds } from "@/features/feeding-records/queries";
import {
  listFoodProductImageUrls,
  listFoodProducts,
} from "@/features/food-products/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewFeedingRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewFeedingRecordPage({
  params,
}: NewFeedingRecordPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
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

  const breadcrumbItems = [
    { label: "トップ", href: "/home" },
    { label: "猫一覧", href: "/cats" },
    { label: cat.name, href: `/cats/${catId}` },
    { label: "ごはん記録", href: `/cats/${catId}/feeding-records` },
    { label: "記録する" },
  ];

  if (foodProducts.length === 0) {
    return (
      <main className={styles.main}>
        <Breadcrumb items={breadcrumbItems} />

        <RecordPageHeading icon={FeedingIcon}>
          {cat.name}のごはんを記録する
        </RecordPageHeading>
        <div className={styles.emptyState}>
          <p>先にごはん商品を登録してください。</p>
          <ButtonLink
            href="/food-products/new"
            variant="primary"
            className={styles.createButton}
          >
            商品を登録する
          </ButtonLink>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Breadcrumb items={breadcrumbItems} />

      <RecordPageHeading icon={FeedingIcon}>
        {cat.name}のごはんを記録する
      </RecordPageHeading>
      <FeedingRecordForm
        action={createFeedingRecordAction.bind(null, catId)}
        foodProducts={foodProducts}
        foodProductImageUrls={foodProductImageUrls}
        recentlyUsedFoodProductIds={recentlyUsedFoodProductIds}
        presets={presets}
        submitLabel="記録する"
      />
    </main>
  );
}
