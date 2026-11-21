import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { CatalogFoodProductEditPage } from "./pages/CatalogFoodProductEditPage";
import { CatalogFoodProductNewPage } from "./pages/CatalogFoodProductNewPage";
import { CatalogFoodProductRequestsPage } from "./pages/CatalogFoodProductRequestsPage";
import { CatalogFoodProductsPage } from "./pages/CatalogFoodProductsPage";
import { HouseholdDetailPage } from "./pages/HouseholdDetailPage";
import { HouseholdsPage } from "./pages/HouseholdsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { OverviewPage } from "./pages/OverviewPage";
import { UserDetailPage } from "./pages/UserDetailPage";
import { UsersPage } from "./pages/UsersPage";

/**
 * 管理画面のページ。書き込みの結果は、移動先の URL のクエリ（`?roleChange=updated&user=…` など）で
 * 表示する（同じ URL を開けば結果の表示を再現でき、VRT でも書き込まずに撮れる）
 */
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:userId" element={<UserDetailPage />} />
        <Route path="households" element={<HouseholdsPage />} />
        <Route
          path="households/:householdId"
          element={<HouseholdDetailPage />}
        />
        <Route path="food-products" element={<CatalogFoodProductsPage />} />
        <Route
          path="food-products/new"
          element={<CatalogFoodProductNewPage />}
        />
        <Route
          path="food-products/:productId/edit"
          element={<CatalogFoodProductEditPage />}
        />
        <Route
          path="food-product-requests"
          element={<CatalogFoodProductRequestsPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
