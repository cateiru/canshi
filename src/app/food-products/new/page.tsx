import { Breadcrumb } from "@/components/ui";
import { createFoodProductAction } from "@/features/food-products/actions";
import { FoodProductForm } from "@/features/food-products/FoodProductForm";
import styles from "../page.module.css";

export default function NewFoodProductPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "ごはん商品一覧", href: "/food-products" },
          { label: "登録する" },
        ]}
      />

      <h1>ごはん商品を登録する</h1>
      <FoodProductForm
        action={createFoodProductAction}
        submitLabel="登録する"
      />
    </main>
  );
}
