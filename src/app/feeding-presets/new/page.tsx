import { Breadcrumb, ButtonLink } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { createFeedingPresetAction } from "@/features/feeding-presets/actions";
import { FeedingPresetForm } from "@/features/feeding-presets/FeedingPresetForm";
import {
  listFoodProductImageUrls,
  listFoodProductsForUser,
} from "@/features/food-products/queries";
import { listHouseholdsForUser } from "@/features/households/queries";
import { Surface } from "@/features/shared/Surface";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewFeedingPresetPageProps = {
  // プリセット一覧の家のまとまりから来たときに、その家を最初から選んでおく
  searchParams: Promise<{ householdId?: string | string[] }>;
};

export default async function NewFeedingPresetPage({
  searchParams,
}: NewFeedingPresetPageProps) {
  const { householdId } = await searchParams;
  const user = await requireUser();
  const [households, foodProducts] = await Promise.all([
    listHouseholdsForUser(user.id),
    listFoodProductsForUser(user.id),
  ]);
  const foodProductImageUrls = await listFoodProductImageUrls(
    foodProducts.map((foodProduct) => foodProduct.id),
  );
  // 所属していない家の ID が指定された場合は、商品のある最初の家を選んでおく
  const defaultHouseholdId =
    households.find((household) => household.id === householdId)?.id ??
    households.find((household) =>
      foodProducts.some(
        (foodProduct) => foodProduct.householdId === household.id,
      ),
    )?.id;

  const breadcrumbItems = [
    { label: "トップ", href: "/home" },
    { label: "設定", href: "/settings" },
    { label: "ごはんプリセット一覧", href: "/feeding-presets" },
    { label: "登録する" },
  ];

  if (foodProducts.length === 0) {
    return (
      <main className={styles.main}>
        <Breadcrumb items={breadcrumbItems} />

        <h1>ごはんプリセットを登録する</h1>
        <Surface>
          <p>先にごはん商品を登録してください。</p>
          <ButtonLink
            href={
              defaultHouseholdId
                ? `/food-products/new?householdId=${encodeURIComponent(defaultHouseholdId)}`
                : "/food-products/new"
            }
            variant="primary"
          >
            商品を登録する
          </ButtonLink>
        </Surface>
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
        households={households}
        defaultHouseholdId={defaultHouseholdId}
        submitLabel="登録する"
      />
    </main>
  );
}
