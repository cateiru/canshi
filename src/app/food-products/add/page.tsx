import { TbPencil, TbSearch } from "react-icons/tb";
import { Breadcrumb, NavCard } from "@/components/ui";
import { FoodProductIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import {
  foodProductsBreadcrumbItems,
  withHouseholdId,
} from "@/features/food-products/paths";
import { findFilterHousehold } from "@/features/households/householdFilter";
import { listHouseholdsForUser } from "@/features/households/queries";
import { Surface } from "@/features/shared/Surface";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type AddFoodProductPageProps = {
  // 家の商品一覧やごはん記録の画面から来たときは、その家の指定を検索・手動の登録へ引き継ぐ
  searchParams: Promise<{ householdId?: string | string[] }>;
};

/** ごはん商品の登録方法（共通のごはん商品から探す・手動で入力する）を選ぶ */
export default async function AddFoodProductPage({
  searchParams,
}: AddFoodProductPageProps) {
  const { householdId } = await searchParams;
  const user = await requireUser();
  const households = await listHouseholdsForUser(user.id);
  const filterHousehold = findFilterHousehold(households, householdId);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          ...foodProductsBreadcrumbItems(filterHousehold),
          { label: "登録する" },
        ]}
      />

      <h1>ごはん商品を登録する</h1>
      {households.length === 0 ? (
        <Surface className={styles.emptyState}>
          <FoodProductIcon aria-hidden="true" size={32} />
          <p>所属している家がありません。</p>
          <p>
            ごはん商品を登録するには家が必要です。設定の「家の設定」から家を作成してください。
          </p>
        </Surface>
      ) : (
        <ul className={styles.list}>
          <li>
            <NavCard
              href={withHouseholdId("/food-products/search", filterHousehold)}
              icon={TbSearch}
              title="共通のごはん商品から探す"
              titleAs="h2"
              description="商品名やメーカー名で検索し、画像付きの候補から選ぶだけで登録できます。登録した後も自由に編集できます。"
            />
          </li>
          <li>
            <NavCard
              href={withHouseholdId("/food-products/new", filterHousehold)}
              icon={TbPencil}
              title="手動で入力する"
              titleAs="h2"
              description="商品名・カロリー・内容量などを自分で入力して登録します。"
            />
          </li>
        </ul>
      )}
    </main>
  );
}
