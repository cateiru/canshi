import { notFound } from "next/navigation";
import { Breadcrumb, ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { listFeedingPresets } from "@/features/feeding-presets/queries";
import { createFeedingRecordAction } from "@/features/feeding-records/actions";
import { FeedingRecordForm } from "@/features/feeding-records/FeedingRecordForm";
import { listRecentlyUsedFoodProductIds } from "@/features/feeding-records/queries";
import { listFoodProducts } from "@/features/food-products/queries";
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

  const breadcrumbItems = [
    { label: "トップ", href: "/" },
    { label: "猫一覧", href: "/cats" },
    { label: cat.name, href: `/cats/${catId}` },
    { label: "ごはん記録", href: `/cats/${catId}/feeding-records` },
    { label: "記録する" },
  ];

  if (foodProducts.length === 0) {
    return (
      <main className={styles.main}>
        <Breadcrumb items={breadcrumbItems} />

        <h1>{cat.name}のごはんを記録する</h1>
        <Card>
          <p>先にごはん商品を登録してください。</p>
          <ButtonLink href="/food-products/new" variant="primary">
            商品を登録する
          </ButtonLink>
        </Card>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <Breadcrumb items={breadcrumbItems} />

      <h1>{cat.name}のごはんを記録する</h1>
      <FeedingRecordForm
        action={createFeedingRecordAction.bind(null, catId)}
        foodProducts={foodProducts}
        recentlyUsedFoodProductIds={recentlyUsedFoodProductIds}
        presets={presets}
        submitLabel="記録する"
      />
    </main>
  );
}
