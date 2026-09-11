import { Breadcrumb, ButtonLink, Card } from "@/components/ui";
import { createFeedingPresetAction } from "@/features/feeding-presets/actions";
import { FeedingPresetForm } from "@/features/feeding-presets/FeedingPresetForm";
import {
  listFoodProductImageUrls,
  listFoodProducts,
} from "@/features/food-products/queries";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export default async function NewFeedingPresetPage() {
  const foodProducts = await listFoodProducts();
  const foodProductImageUrls = await listFoodProductImageUrls(
    foodProducts.map((foodProduct) => foodProduct.id),
  );

  const breadcrumbItems = [
    { label: "トップ", href: "/home" },
    { label: "ごはんプリセット一覧", href: "/feeding-presets" },
    { label: "登録する" },
  ];

  if (foodProducts.length === 0) {
    return (
      <main className={styles.main}>
        <Breadcrumb items={breadcrumbItems} />

        <h1>ごはんプリセットを登録する</h1>
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

      <h1>ごはんプリセットを登録する</h1>
      <FeedingPresetForm
        action={createFeedingPresetAction}
        foodProducts={foodProducts}
        foodProductImageUrls={foodProductImageUrls}
        submitLabel="登録する"
      />
    </main>
  );
}
