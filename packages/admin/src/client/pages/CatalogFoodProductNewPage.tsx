import { useNavigate } from "react-router";
import { EMPTY_INPUT } from "../../catalog/form";
import { CatalogFoodProductForm } from "../components/CatalogFoodProductForm";
import { Page } from "../components/Page";

export const CATALOG_BREADCRUMB_ROOT = {
  label: "共通のごはん商品",
  href: "/food-products",
};

/** 登録・更新の結果を表示する一覧の URL */
export function catalogResultUrl(result: "created" | "updated", id: string) {
  return `/food-products?${new URLSearchParams({ catalogChange: result, product: id })}`;
}

export function CatalogFoodProductNewPage() {
  const navigate = useNavigate();
  return (
    <Page
      title="共通のごはん商品を登録する"
      breadcrumb={[CATALOG_BREADCRUMB_ROOT, { label: "登録する" }]}
    >
      <CatalogFoodProductForm
        initialInput={EMPTY_INPUT}
        onSaved={(id) => navigate(catalogResultUrl("created", id))}
      />
    </Page>
  );
}
