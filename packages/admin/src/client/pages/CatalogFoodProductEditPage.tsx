import { useNavigate, useParams } from "react-router";
import type { CatalogFoodProductResponse } from "../../api/types";
import { toInput } from "../../catalog/form";
import { ApiError, segment } from "../api";
import { CatalogFoodProductForm } from "../components/CatalogFoodProductForm";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { useApi } from "../useApi";
import {
  CATALOG_BREADCRUMB_ROOT,
  catalogResultUrl,
} from "./CatalogFoodProductNewPage";
import { catalogImageUrl } from "./CatalogFoodProductsPage";
import { NotFoundPage } from "./NotFoundPage";

export function CatalogFoodProductEditPage() {
  const productId = useParams().productId ?? "";
  const navigate = useNavigate();
  const { state, reload } = useApi<CatalogFoodProductResponse>(
    `/food-products/${segment(productId)}`,
  );
  if (
    state.status === "error" &&
    state.error instanceof ApiError &&
    state.error.status === 404
  ) {
    return (
      <NotFoundPage message="共通のごはん商品が見つかりませんでした。削除された可能性があります。" />
    );
  }
  return (
    <Page
      title={
        state.status === "success"
          ? `${state.data.product.name} を編集する`
          : "共通のごはん商品を編集する"
      }
      breadcrumb={[CATALOG_BREADCRUMB_ROOT, { label: "編集する" }]}
    >
      <Loadable state={state} reload={reload}>
        {({ product }) => (
          <CatalogFoodProductForm
            product={product}
            currentImageUrl={
              product.imageAssetId
                ? catalogImageUrl(product.id, product.imageAssetId)
                : null
            }
            initialInput={toInput(product)}
            onSaved={(id) => navigate(catalogResultUrl("updated", id))}
          />
        )}
      </Loadable>
    </Page>
  );
}
