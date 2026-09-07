import { Breadcrumb, ButtonLink, Card } from "@/components/ui";
import { deleteFoodProductAction } from "@/features/food-products/actions";
import { DeleteFoodProductButton } from "@/features/food-products/DeleteFoodProductButton";
import {
  NUTRITION_TYPE_LABEL,
  TEXTURE_TYPE_LABEL,
} from "@/features/food-products/labels";
import { listFoodProducts } from "@/features/food-products/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function FoodProductsPage() {
  const foodProductList = await listFoodProducts();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/" }, { label: "ごはん商品一覧" }]}
      />

      <div className={styles.header}>
        <h1>ごはん商品一覧</h1>
        <ButtonLink href="/food-products/new" variant="primary">
          商品を登録する
        </ButtonLink>
      </div>

      {foodProductList.length === 0 ? (
        <Card>
          <p>まだごはん商品が登録されていません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink href="/food-products/new" variant="primary">
              最初の商品を登録する
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {foodProductList.map((foodProduct) => (
            <li key={foodProduct.id}>
              <Card title={foodProduct.name}>
                <dl className={styles.details}>
                  <dt>カロリー</dt>
                  <dd>{foodProduct.kcalPer100g} kcal/100g</dd>
                  <dt>内容量</dt>
                  <dd>{foodProduct.packageAmountG} g</dd>
                  <dt>区分</dt>
                  <dd>{NUTRITION_TYPE_LABEL[foodProduct.nutritionType]}</dd>
                  <dt>形状</dt>
                  <dd>{TEXTURE_TYPE_LABEL[foodProduct.textureType]}</dd>
                </dl>
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/food-products/${foodProduct.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteFoodProductButton
                    action={deleteFoodProductAction.bind(null, foodProduct.id)}
                    foodProductName={foodProduct.name}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
