import { TbBowl, TbPencil, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { deleteFoodProductAction } from "@/features/food-products/actions";
import { DeleteFoodProductButton } from "@/features/food-products/DeleteFoodProductButton";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import {
  NUTRITION_TYPE_LABEL,
  TEXTURE_TYPE_LABEL,
} from "@/features/food-products/labels";
import {
  listFoodProductImageUrls,
  listFoodProducts,
} from "@/features/food-products/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function FoodProductsPage() {
  const foodProductList = await listFoodProducts();
  const imageUrls = await listFoodProductImageUrls(
    foodProductList.map((foodProduct) => foodProduct.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "ごはん商品一覧" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbBowl}>ごはん商品一覧</RecordPageHeading>
        <ButtonLink href="/food-products/new" variant="primary">
          <TbPlus aria-hidden="true" size={18} />
          商品を登録する
        </ButtonLink>
      </div>

      {foodProductList.length === 0 ? (
        <Surface className={styles.emptyState}>
          <TbBowl aria-hidden="true" size={32} />
          <p>まだごはん商品が登録されていません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink href="/food-products/new" variant="primary">
              最初の商品を登録する
            </ButtonLink>
          </div>
        </Surface>
      ) : (
        <ul className={styles.list}>
          {foodProductList.map((foodProduct) => (
            <li key={foodProduct.id}>
              <article
                className={styles.productCard}
                aria-label={foodProduct.name}
              >
                <div className={styles.productHeader}>
                  <FoodProductImage
                    name={foodProduct.name}
                    thumbnailUrl={imageUrls[foodProduct.id]}
                  />
                  <h2 className={styles.productTitle}>{foodProduct.name}</h2>
                  <div className={styles.cardActions}>
                    <ButtonLink
                      href={`/food-products/${foodProduct.id}/edit`}
                      variant="secondary"
                      className={styles.iconButton}
                      aria-label="編集する"
                      title="編集する"
                    >
                      <TbPencil aria-hidden="true" size={20} />
                    </ButtonLink>
                    <DeleteFoodProductButton
                      action={deleteFoodProductAction.bind(
                        null,
                        foodProduct.id,
                      )}
                      foodProductName={foodProduct.name}
                      className={styles.iconButton}
                    />
                  </div>
                </div>
                <p className={styles.category}>
                  {NUTRITION_TYPE_LABEL[foodProduct.nutritionType]} ・{" "}
                  {TEXTURE_TYPE_LABEL[foodProduct.textureType]}
                </p>
                <dl className={styles.summary}>
                  <div>
                    <dt>カロリー</dt>
                    <dd>
                      {foodProduct.kcalPer100g}
                      <span>kcal/100g</span>
                    </dd>
                  </div>
                  <div>
                    <dt>内容量</dt>
                    <dd>
                      {foodProduct.packageAmountG}
                      <span>g</span>
                    </dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
