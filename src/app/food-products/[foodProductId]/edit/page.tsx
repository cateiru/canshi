import { notFound } from "next/navigation";
import { updateFoodProductAction } from "@/features/food-products/actions";
import { FoodProductForm } from "@/features/food-products/FoodProductForm";
import { getFoodProductById } from "@/features/food-products/queries";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditFoodProductPageProps = {
  params: Promise<{ foodProductId: string }>;
};

export default async function EditFoodProductPage({
  params,
}: EditFoodProductPageProps) {
  const { foodProductId } = await params;
  const foodProduct = await getFoodProductById(foodProductId);

  if (!foodProduct) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1>{foodProduct.name}を編集する</h1>
      <FoodProductForm
        action={updateFoodProductAction.bind(null, foodProduct.id)}
        foodProduct={foodProduct}
        submitLabel="更新する"
      />
    </main>
  );
}
