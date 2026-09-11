import { Breadcrumb } from "@/components/ui";
import {
  createFoodProductAction,
  updateFoodProductAction,
} from "@/features/food-products/actions";
import { FoodProductForm } from "@/features/food-products/FoodProductForm";
import { resolveMediaLimits } from "@/features/media/limits";
import styles from "../page.module.css";

export default function NewFoodProductPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ごはん商品一覧", href: "/food-products" },
          { label: "登録する" },
        ]}
      />

      <h1>ごはん商品を登録する</h1>
      <FoodProductForm
        action={createFoodProductAction}
        updateAction={updateFoodProductAction}
        mediaLimits={resolveMediaLimits()}
        submitLabel="登録する"
      />
    </main>
  );
}
