import {
  Alert,
  Button,
  ButtonLink,
  Collapsible,
  FormField,
  IconButton,
  IconButtonLink,
  Table,
  TableActionCell,
  TableActionHeader,
} from "@canshi/shared/ui";
import { useContext, useState } from "react";
import { DisclosureStateContext } from "react-aria-components";
import { TbPencil, TbPhoto, TbPlus, TbSearch, TbTrash } from "react-icons/tb";
import { useNavigate, useSearchParams } from "react-router";
import type {
  CatalogFoodProductJson,
  CatalogFoodProductsResponse,
} from "../../api/types";
import {
  type CatalogListSearch,
  type CatalogManufacturerGroup,
  groupCatalogFoodProducts,
  matchesCatalogKeywords,
  parseCatalogListSearch,
} from "../../catalog/search";
import { segment, sendJson } from "../api";
import common from "../common.module.css";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import {
  formatDateTime,
  formatPackageSize,
  formatTarget,
  NUTRITION_TYPE_LABEL,
  TEXTURE_TYPE_LABEL,
} from "../format";
import { RouterLink } from "../RouterLink";
import { useApi } from "../useApi";
import styles from "./CatalogFoodProductsPage.module.css";
import table from "./table.module.css";

const NO_MANUFACTURER_LABEL = "メーカー名なし";

/** 共通のごはん商品の画像の URL。差し替えたら別の URL になるよう、画像の ID を付ける */
export function catalogImageUrl(productId: string, imageAssetId: string) {
  return `/api/food-products/${segment(productId)}/image?v=${encodeURIComponent(imageAssetId)}`;
}

/** 直前に行った登録・更新・削除の結果（URL のクエリ `catalogChange`・`product`） */
function CatalogChangeNotice(props: {
  change: string | null;
  product: CatalogFoodProductJson | undefined;
}) {
  const { change, product } = props;
  if (change === "deleted") {
    return (
      <Alert color="success" role="status">
        共通のごはん商品を削除しました。
      </Alert>
    );
  }
  if (!product) {
    return null;
  }
  switch (change) {
    case "created":
      return (
        <Alert color="success" role="status">
          {product.name} を登録しました。
        </Alert>
      );
    case "updated":
      return (
        <Alert color="success" role="status">
          {product.name} を更新しました。
        </Alert>
      );
    default:
      return null;
  }
}

function CatalogFoodProductRow(props: {
  product: CatalogFoodProductJson;
  onDelete: (product: CatalogFoodProductJson) => void;
}) {
  const { product } = props;
  const target = formatTarget(product);
  return (
    <tr>
      <td>
        {product.imageAssetId ? (
          <img
            className={styles.image}
            src={catalogImageUrl(product.id, product.imageAssetId)}
            alt=""
            width={64}
            height={64}
            loading="lazy"
          />
        ) : (
          <span className={`${styles.image} ${styles.placeholder}`}>
            <TbPhoto size={24} aria-label="画像なし" role="img" />
          </span>
        )}
      </td>
      <th scope="row">
        <span className={table.name}>{product.name}</span>
        {product.searchKeywords.length > 0 ? (
          <span className={common.sub}>
            検索キーワード：{product.searchKeywords.join("、")}
          </span>
        ) : null}
        <code className={common.code}>{product.id}</code>
      </th>
      <td className={common.nowrap}>
        {NUTRITION_TYPE_LABEL[product.nutritionType]}
        <br />
        {TEXTURE_TYPE_LABEL[product.textureType]}
      </td>
      <td className={common.num}>{product.kcalPer100g} kcal/100g</td>
      <td className={common.num}>
        {product.packageSizes.map((size) => (
          <span
            key={`${size.amountG}/${size.unit ?? ""}`}
            className={styles.packageSize}
          >
            {formatPackageSize(size)}
          </span>
        ))}
      </td>
      <td>{target ?? <span className={common.empty}>-</span>}</td>
      <td className={common.num}>{product.addedCount}</td>
      <td className={common.nowrap}>{formatDateTime(product.updatedAt)}</td>
      <TableActionCell>
        <IconButtonLink
          icon={TbPencil}
          href={`/food-products/${segment(product.id)}/edit`}
          aria-label={`${product.name}を編集する`}
          title="編集する"
          linkComponent={RouterLink}
        />
        <IconButton
          icon={TbTrash}
          aria-label={`${product.name}を削除する`}
          title="削除する"
          onPress={() => props.onDelete(product)}
        />
      </TableActionCell>
    </tr>
  );
}

/** このまとまりの商品を、商品名・検索キーワードで絞り込むフォーム */
function ManufacturerSearchForm(props: {
  manufacturer: string | null;
  label: string;
  search: CatalogListSearch | null;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState(props.search?.query ?? "");
  return (
    <form
      className={styles.searchForm}
      onSubmit={(event) => {
        event.preventDefault();
        const params = new URLSearchParams({
          manufacturer: props.manufacturer ?? "",
          q: query,
        });
        navigate(`/food-products?${params}`);
      }}
    >
      <FormField
        label={`${props.label}の商品を検索`}
        type="search"
        value={query}
        onChange={setQuery}
        placeholder="商品名・検索キーワード"
        className={`${styles.searchField} ${table.hiddenLabel}`}
      />
      <Button type="submit" variant="secondary" leftIcon={TbSearch}>
        検索する
      </Button>
      {props.search ? (
        <ButtonLink
          href="/food-products"
          variant="ghost"
          linkComponent={RouterLink}
        >
          検索をやめる
        </ButtonLink>
      ) : null}
    </form>
  );
}

/**
 * まとまりの中身（検索フォームと商品の表）。閉じているあいだは描かない。商品が数百件あると、
 * パスワードマネージャーの拡張機能（1Password など）がまとまりを開くたびに DOM 全体を調べ直して
 * ページが固まるため、開いたまとまりの分だけを DOM に置く
 */
function ManufacturerBody(props: {
  group: CatalogManufacturerGroup<CatalogFoodProductJson>;
  label: string;
  search: CatalogListSearch | null;
  products: CatalogFoodProductJson[];
  onDelete: (product: CatalogFoodProductJson) => void;
}) {
  const disclosure = useContext(DisclosureStateContext);
  if (disclosure && !disclosure.isExpanded) {
    return null;
  }
  const { search, products } = props;
  return (
    <div className={styles.body}>
      <ManufacturerSearchForm
        // 検索し直したら、入力欄を検索語に合わせる
        key={search?.query ?? ""}
        manufacturer={props.group.manufacturer}
        label={props.label}
        search={search}
      />
      {products.length === 0 ? (
        <p className={common.empty}>
          「{search?.query}」に一致する商品はありません。
        </p>
      ) : (
        <Table aria-label={`${props.label}の共通のごはん商品`}>
          <thead>
            <tr>
              <th scope="col">画像</th>
              <th scope="col">商品名</th>
              <th scope="col">区分・種類</th>
              <th scope="col">カロリー</th>
              <th scope="col">内容量</th>
              <th scope="col">対象</th>
              <th scope="col">家への追加</th>
              <th scope="col">更新日時</th>
              <TableActionHeader />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <CatalogFoodProductRow
                key={product.id}
                product={product}
                onDelete={props.onDelete}
              />
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

/**
 * メーカーごとに折りたたむまとまり。中の検索フォームはこのメーカーの商品だけを、商品名・検索
 * キーワードで絞り込む（`/food-products?manufacturer=…&q=…`。メーカー名のないまとまりは
 * `manufacturer` を空にする）
 */
function ManufacturerSection(props: {
  group: CatalogManufacturerGroup<CatalogFoodProductJson>;
  /** このまとまりで検索しているときの検索。検索していなければ null */
  search: CatalogListSearch | null;
  /** 最初から開いておくか（検索しているまとまり・登録や更新をした商品のまとまり） */
  open: boolean;
  onDelete: (product: CatalogFoodProductJson) => void;
}) {
  const { group, search } = props;
  const label = group.manufacturer ?? NO_MANUFACTURER_LABEL;
  const products = search
    ? group.products.filter((product) =>
        matchesCatalogKeywords(product, search.keywords),
      )
    : group.products;
  return (
    <Collapsible
      title={label}
      headingLevel={3}
      defaultExpanded={props.open}
      titleAside={
        search
          ? `${group.products.length} 件中 ${products.length} 件`
          : `${group.products.length} 件`
      }
    >
      <ManufacturerBody
        group={group}
        label={label}
        search={search}
        products={products}
        onDelete={props.onDelete}
      />
    </Collapsible>
  );
}

export function CatalogFoodProductsPage() {
  const { state, reload } =
    useApi<CatalogFoodProductsResponse>("/food-products");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<CatalogFoodProductJson | null>(null);
  const search = parseCatalogListSearch(
    searchParams.get("manufacturer") ?? undefined,
    searchParams.get("q") ?? undefined,
  );
  const change = searchParams.get("catalogChange");
  const productId = searchParams.get("product");

  return (
    <Page
      title="共通のごはん商品"
      actions={
        <ButtonLink
          href="/food-products/new"
          variant="primary"
          leftIcon={TbPlus}
          linkComponent={RouterLink}
        >
          共通のごはん商品を登録する
        </ButtonLink>
      }
    >
      <p className={common.lead}>
        どの家のユーザーも、ごはん商品の登録時に検索して家に追加できる商品です。家に追加した商品は内容を写したものなので、ここで編集・削除しても家の商品は変わりません。
      </p>
      <Loadable state={state} reload={reload}>
        {({ products }) => {
          const changedProduct = products.find(
            (product) => product.id === productId,
          );
          // 検索しているまとまりと、登録・更新した商品のまとまりだけを開いておく
          const changedManufacturer =
            change === "created" || change === "updated"
              ? changedProduct?.manufacturer
              : undefined;
          return (
            <>
              <CatalogChangeNotice change={change} product={changedProduct} />
              {products.length === 0 ? (
                <p className={common.empty}>
                  共通のごはん商品はまだありません。
                </p>
              ) : (
                <div className={styles.groups}>
                  {groupCatalogFoodProducts(products).map((group) => {
                    const searching =
                      search !== null &&
                      search.manufacturer === group.manufacturer;
                    const open =
                      searching || changedManufacturer === group.manufacturer;
                    return (
                      <ManufacturerSection
                        // 検索・登録で開くまとまりが変わったら、開いた状態で作り直す
                        key={`${group.manufacturer ?? ""}:${open ? searchParams : ""}`}
                        group={group}
                        search={searching ? search : null}
                        open={open}
                        onDelete={setDeleting}
                      />
                    );
                  })}
                </div>
              )}
            </>
          );
        }}
      </Loadable>
      <ConfirmDialog
        open={deleting !== null}
        title="共通のごはん商品を削除する"
        confirmLabel="削除する"
        variant="danger"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) {
            return;
          }
          await sendJson("DELETE", `/food-products/${segment(deleting.id)}`);
          setDeleting(null);
          navigate("/food-products?catalogChange=deleted");
          reload();
        }}
      >
        <p>{deleting?.name} を削除しますか？</p>
        <p>家に追加済みの商品は残ります。</p>
      </ConfirmDialog>
    </Page>
  );
}
