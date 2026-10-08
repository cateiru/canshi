import { TbPencil, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink, IconButtonLink } from "@/components/ui";
import { FoodProductIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { deleteFoodProductAction } from "@/features/food-products/actions";
import { DeleteFoodProductButton } from "@/features/food-products/DeleteFoodProductButton";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import {
  NUTRITION_TYPE_LABEL,
  TEXTURE_TYPE_LABEL,
} from "@/features/food-products/labels";
import {
  listFoodProductImageUrls,
  listFoodProductsForUser,
} from "@/features/food-products/queries";
import { groupByHousehold } from "@/features/households/groupCats";
import { HouseholdSections } from "@/features/households/HouseholdSections";
import { listHouseholdsForUser } from "@/features/households/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/** 家ごとの開閉状態を保存する localStorage のキー */
function householdExpandedStorageKey(householdId: string) {
  return `canshi:food-products-household-expanded:${householdId}`;
}

export default async function FoodProductsPage() {
  const user = await requireUser();
  const [householdList, foodProductList] = await Promise.all([
    listHouseholdsForUser(user.id),
    listFoodProductsForUser(user.id),
  ]);
  const imageUrls = await listFoodProductImageUrls(
    foodProductList.map((foodProduct) => foodProduct.id),
  );
  const groups = groupByHousehold(householdList, foodProductList);

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
        <RecordPageHeading icon={FoodProductIcon}>
          ごはん商品一覧
        </RecordPageHeading>
        <ButtonLink
          href="/food-products/new"
          variant="primary"
          leftIcon={TbPlus}
        >
          商品を登録する
        </ButtonLink>
      </div>

      {groups.length === 0 ? (
        <Surface className={styles.emptyState}>
          <FoodProductIcon aria-hidden="true" size={32} />
          <p>所属している家がありません。</p>
          <p>
            ごはん商品を登録するには家が必要です。管理者に家の作成を依頼してください。
          </p>
        </Surface>
      ) : (
        <HouseholdSections
          groups={groups}
          storageKey={householdExpandedStorageKey}
          countLabel={(count) => `${count}件`}
          className={styles.households}
        >
          {({ household, items }) =>
            items.length === 0 ? (
              <Surface className={styles.emptyState}>
                <FoodProductIcon aria-hidden="true" size={32} />
                <p>まだごはん商品が登録されていません。</p>
                <div className={styles.emptyActions}>
                  {/* 登録画面でこの家を最初から選んでおく */}
                  <ButtonLink
                    href={`/food-products/new?householdId=${encodeURIComponent(household.id)}`}
                    variant="primary"
                  >
                    最初の商品を登録する
                  </ButtonLink>
                </div>
              </Surface>
            ) : (
              <ul className={styles.list}>
                {items.map((foodProduct) => (
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
                        <h2 className={styles.productTitle}>
                          {foodProduct.name}
                        </h2>
                        <div className={styles.cardActions}>
                          <IconButtonLink
                            href={`/food-products/${foodProduct.id}/edit`}
                            icon={TbPencil}
                            aria-label="編集する"
                            title="編集する"
                          />
                          <DeleteFoodProductButton
                            action={deleteFoodProductAction.bind(
                              null,
                              foodProduct.id,
                            )}
                            foodProductName={foodProduct.name}
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
                            <span>
                              g
                              {foodProduct.packageUnit
                                ? `/${foodProduct.packageUnit}`
                                : null}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </article>
                  </li>
                ))}
              </ul>
            )
          }
        </HouseholdSections>
      )}
    </main>
  );
}
