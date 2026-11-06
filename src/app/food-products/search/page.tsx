import { Badge, Breadcrumb, ButtonLink } from "@/components/ui";
import { FoodProductIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { ScaledIcon } from "@/components/ui/ScaledIcon/ScaledIcon";
import { requireUser } from "@/features/auth/presentation/session";
import { hasOpenCatalogFoodProductRequest } from "@/features/catalog-food-products/application/requests";
import {
  hasCatalogSearchCriteria,
  toCatalogSearchQuery,
} from "@/features/catalog-food-products/domain/catalogRequest";
import {
  catalogPackageSizes,
  formatPackageSize,
  toPackageSizeValue,
} from "@/features/catalog-food-products/domain/packageSizes";
import {
  hasAdvancedCriteria,
  parseCatalogSearchParams,
} from "@/features/catalog-food-products/domain/search";
import {
  CATALOG_SEARCH_LIMIT,
  listAddedCatalogFoodProductIds,
  listCatalogFoodProductImageUrls,
  searchCatalogFoodProducts,
} from "@/features/catalog-food-products/infrastructure/queries";
import { AddCatalogFoodProductButton } from "@/features/catalog-food-products/presentation/AddCatalogFoodProductButton";
import {
  addCatalogFoodProductAction,
  requestCatalogFoodProductAction,
} from "@/features/catalog-food-products/presentation/actions";
import { CatalogSearchForm } from "@/features/catalog-food-products/presentation/CatalogSearchForm";
import { RequestCatalogFoodProductButton } from "@/features/catalog-food-products/presentation/RequestCatalogFoodProductButton";
import {
  formatFoodProductTarget,
  NUTRITION_TYPE_LABEL,
  TEXTURE_TYPE_LABEL,
} from "@/features/food-products/domain/labels";
import { FoodProductImage } from "@/features/food-products/presentation/FoodProductImage";
import {
  foodProductsBreadcrumbItems,
  withHouseholdId,
} from "@/features/food-products/presentation/paths";
import { listHouseholdsForUser } from "@/features/households/infrastructure/queries";
import { findFilterHousehold } from "@/features/households/presentation/householdFilter";
import { ReplaceNavigation } from "@/features/navigation/ReplaceNavigation";
import { Surface } from "@/features/shared/Surface";
import listStyles from "../page.module.css";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SearchFoodProductsPageProps = {
  // 検索条件（`parseCatalogSearchParams`）と、追加先の家（`householdId`）
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** 共通のごはん商品を検索し、選んだ商品を家のごはん商品として追加する */
export default async function SearchFoodProductsPage({
  searchParams,
}: SearchFoodProductsPageProps) {
  const params = await searchParams;
  const user = await requireUser();
  const households = await listHouseholdsForUser(user.id);
  // 家を指定して開いたときは、追加した後にその家の商品一覧へ戻す
  const filterHousehold = findFilterHousehold(households, params.householdId);
  const household = filterHousehold ?? households[0] ?? null;
  const criteria = parseCatalogSearchParams(params);

  const addHref = withHouseholdId("/food-products/add", filterHousehold);
  const breadcrumb = (
    // 登録方法を選び直すときは検索ページを履歴に残さない（追加・保存の後に戻ると、
    // 登録を始めた画面に戻るようにする）
    <ReplaceNavigation href={addHref}>
      <Breadcrumb
        items={[
          ...foodProductsBreadcrumbItems(filterHousehold),
          { label: "登録する", href: addHref, replace: true },
          { label: "共通のごはん商品から探す" },
        ]}
      />
    </ReplaceNavigation>
  );

  if (!household) {
    return (
      <main className={listStyles.main}>
        {breadcrumb}
        <h1>共通のごはん商品から探す</h1>
        <Surface className={listStyles.emptyState}>
          <ScaledIcon icon={FoodProductIcon} aria-hidden="true" size={32} />
          <p>所属している家がありません。</p>
          <p>
            ごはん商品を登録するには家が必要です。設定の「家の設定」から家を作成してください。
          </p>
        </Surface>
      </main>
    );
  }

  const [{ items, hasMore }, addedIds] = await Promise.all([
    searchCatalogFoodProducts(criteria),
    listAddedCatalogFoodProductIds(household.id),
  ]);
  const imageUrls = await listCatalogFoodProductImageUrls(
    items.map((item) => item.id),
  );
  // 条件を指定して見つからなかったときは、その条件で共通のごはん商品をリクエストできる
  // （条件なしで見つからないのは、共通のごはん商品が 1 件もないときだけなのでリクエストさせない）
  const canRequest = items.length === 0 && hasCatalogSearchCriteria(criteria);
  const isRequested = canRequest
    ? await hasOpenCatalogFoodProductRequest(user.id, criteria)
    : false;

  return (
    <main className={listStyles.main}>
      {breadcrumb}
      <h1>共通のごはん商品から探す</h1>

      <CatalogSearchForm
        // 条件を変えて検索し直したときに、入力欄を URL の条件で作り直す
        key={JSON.stringify(criteria)}
        households={households}
        householdId={household.id}
        isHouseholdSpecified={filterHousehold != null}
        defaultValues={{
          q: criteria.keywords.join(" "),
          manufacturer: criteria.manufacturer ?? "",
          textureType: criteria.textureType,
          nutritionType: criteria.nutritionType,
          lifeStage: criteria.lifeStage,
          targetBreed: criteria.targetBreed ?? "",
        }}
        isAdvancedExpanded={hasAdvancedCriteria(criteria)}
      />

      <section
        aria-labelledby="catalog-results-heading"
        className={styles.results}
      >
        <h2 id="catalog-results-heading" className={styles.resultsHeading}>
          {items.length === 0
            ? "見つかりませんでした"
            : `${hasMore ? `${CATALOG_SEARCH_LIMIT}件以上` : `${items.length}件`}の候補`}
        </h2>
        {households.length > 1 ? (
          <p className={styles.note}>「{household.name}」に追加します。</p>
        ) : null}
        {hasMore ? (
          <p className={styles.note}>
            先頭の{CATALOG_SEARCH_LIMIT}
            件を表示しています。見つからないときは条件を絞り込んでください。
          </p>
        ) : null}

        {items.length === 0 ? (
          <Surface className={listStyles.emptyState}>
            <ScaledIcon icon={FoodProductIcon} aria-hidden="true" size={32} />
            <p>条件に合う共通のごはん商品はありませんでした。</p>
            <p>キーワードを変えるか、手動で入力して登録してください。</p>
            <div className={listStyles.emptyActions}>
              {/* 検索ページを履歴に残さない（保存した後に戻ると、登録を始めた画面に戻るようにする） */}
              <ReplaceNavigation
                href={withHouseholdId("/food-products/new", filterHousehold)}
              >
                <ButtonLink
                  href={withHouseholdId("/food-products/new", filterHousehold)}
                  replace
                  variant="primary"
                >
                  手動で入力する
                </ButtonLink>
              </ReplaceNavigation>
            </div>
            {canRequest ? (
              <RequestCatalogFoodProductButton
                // 条件を変えて検索し直したときに、リクエストの状態を作り直す
                key={toCatalogSearchQuery(criteria)}
                action={requestCatalogFoodProductAction}
                searchQuery={toCatalogSearchQuery(criteria)}
                isRequested={isRequested}
              />
            ) : null}
          </Surface>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => {
              const target = formatFoodProductTarget(item);
              const packageSizes = catalogPackageSizes(item);
              return (
                <li key={item.id}>
                  <article className={styles.card} aria-label={item.name}>
                    <FoodProductImage
                      name={item.name}
                      thumbnailUrl={imageUrls[item.id]}
                      loading="lazy"
                    />
                    <div className={styles.body}>
                      <h3 className={styles.name}>{item.name}</h3>
                      {item.manufacturer ? (
                        <p className={styles.meta}>{item.manufacturer}</p>
                      ) : null}
                      <p className={styles.meta}>
                        {NUTRITION_TYPE_LABEL[item.nutritionType]} ・{" "}
                        {TEXTURE_TYPE_LABEL[item.textureType]} ・{" "}
                        {item.kcalPer100g}kcal/100g ・{" "}
                        {packageSizes.map(formatPackageSize).join(" / ")}
                      </p>
                      {target ? (
                        <p className={styles.meta}>対象：{target}</p>
                      ) : null}
                    </div>
                    <div className={styles.action}>
                      {addedIds.has(item.id) ? (
                        <Badge color="success">追加済み</Badge>
                      ) : (
                        <AddCatalogFoodProductButton
                          action={addCatalogFoodProductAction.bind(
                            null,
                            item.id,
                          )}
                          householdId={household.id}
                          returnToHousehold={filterHousehold != null}
                          productName={item.name}
                          packageSizes={packageSizes.map((size) => ({
                            value: toPackageSizeValue(size),
                            label: formatPackageSize(size),
                          }))}
                        />
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
