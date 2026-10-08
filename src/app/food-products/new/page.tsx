import { Breadcrumb } from "@/components/ui";
import { FoodProductIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import {
  createFoodProductAction,
  updateFoodProductAction,
} from "@/features/food-products/actions";
import { FoodProductForm } from "@/features/food-products/FoodProductForm";
import { listHouseholdsForUser } from "@/features/households/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import { Surface } from "@/features/shared/Surface";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewFoodProductPageProps = {
  // 商品一覧の家のまとまりや、ごはん記録の画面から来たときに、その家を最初から選んでおく
  searchParams: Promise<{ householdId?: string | string[] }>;
};

export default async function NewFoodProductPage({
  searchParams,
}: NewFoodProductPageProps) {
  const { householdId } = await searchParams;
  const user = await requireUser();
  const households = await listHouseholdsForUser(user.id);
  // 所属していない家の ID が指定された場合は、先頭の家を選んでおく
  const defaultHouseholdId = households.find(
    (household) => household.id === householdId,
  )?.id;

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "ごはん商品一覧", href: "/food-products" },
          { label: "登録する" },
        ]}
      />

      <h1>ごはん商品を登録する</h1>
      {households.length === 0 ? (
        <Surface className={styles.emptyState}>
          <FoodProductIcon aria-hidden="true" size={32} />
          <p>所属している家がありません。</p>
          <p>
            ごはん商品を登録するには家が必要です。管理者に家の作成を依頼してください。
          </p>
        </Surface>
      ) : (
        <FoodProductForm
          action={createFoodProductAction}
          updateAction={updateFoodProductAction}
          households={households}
          defaultHouseholdId={defaultHouseholdId}
          mediaLimits={resolveMediaLimits()}
          submitLabel="登録する"
        />
      )}
    </main>
  );
}
