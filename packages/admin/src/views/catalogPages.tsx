import {
  type CatalogFoodProductErrors,
  type CatalogFoodProductInput,
  LIFE_STAGES,
  type LifeStage,
  NUTRITION_TYPES,
  type NutritionType,
  TEXTURE_TYPES,
  type TextureType,
} from "../catalog/form";
import { IMAGE_MAX_EDGE } from "../catalog/image";
import type { CatalogFoodProduct } from "../db/catalogFoodProducts";
import { formatDateTime } from "./format";

// メインアプリの `src/features/food-products/labels.ts` と同じ表記にする
const NUTRITION_TYPE_LABEL: Record<NutritionType, string> = {
  complete: "総合栄養食",
  general: "一般食",
};

const TEXTURE_TYPE_LABEL: Record<TextureType, string> = {
  dry: "ドライ",
  wet: "ウェット",
  soup: "スープ",
};

const LIFE_STAGE_LABEL: Record<LifeStage, string> = {
  kitten: "キトン",
  adult: "成猫",
  senior: "シニア",
  care: "療養",
};

/** 直前に行った共通のごはん商品の登録・更新・削除 */
export type CatalogChange =
  | { result: "created" | "updated"; product: CatalogFoodProduct }
  | { result: "deleted" };

function CatalogChangeNotice(props: { change: CatalogChange }) {
  const { change } = props;
  switch (change.result) {
    case "created":
      return (
        <p class="notice" role="status">
          {change.product.name} を登録しました。
        </p>
      );
    case "updated":
      return (
        <p class="notice" role="status">
          {change.product.name} を更新しました。
        </p>
      );
    case "deleted":
      return (
        <p class="notice" role="status">
          共通のごはん商品を削除しました。
        </p>
      );
  }
}

function productPath(id: string) {
  return `/food-products/${encodeURIComponent(id)}`;
}

function formatTarget(product: CatalogFoodProduct) {
  const parts = [
    product.lifeStages.map((stage) => LIFE_STAGE_LABEL[stage]).join("・"),
    product.targetBreed ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ・ ") : null;
}

export function CatalogFoodProductsPage(props: {
  products: CatalogFoodProduct[];
  change?: CatalogChange;
}) {
  return (
    <>
      {/* 日本語の文の途中で改行すると空白が入るため、文ごとに分けて書く */}
      <p class="lead">
        <span>
          どの家のユーザーも、ごはん商品の登録時に検索して家に追加できる商品です。
        </span>
        <span>
          家に追加した商品は内容を写したものなので、ここで編集・削除しても家の商品は変わりません。
        </span>
      </p>
      {props.change && <CatalogChangeNotice change={props.change} />}
      <p>
        <a href="/food-products/new" class="button-link">
          共通のごはん商品を登録する
        </a>
      </p>
      {props.products.length === 0 ? (
        <p class="empty">共通のごはん商品はまだありません。</p>
      ) : (
        <div class="table-wrap">
          <table>
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
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {props.products.map((product) => {
                const target = formatTarget(product);
                return (
                  <tr>
                    <td>
                      {product.imageAssetId ? (
                        <img
                          class="product-image"
                          src={`${productPath(product.id)}/image?v=${encodeURIComponent(product.imageAssetId)}`}
                          alt=""
                          width={64}
                          height={64}
                          loading="lazy"
                        />
                      ) : (
                        <span class="empty">なし</span>
                      )}
                    </td>
                    <td>
                      {product.name}
                      {product.manufacturer && (
                        <>
                          <br />
                          {product.manufacturer}
                        </>
                      )}
                      <br />
                      <code>{product.id}</code>
                    </td>
                    <td class="nowrap">
                      {NUTRITION_TYPE_LABEL[product.nutritionType]}
                      <br />
                      {TEXTURE_TYPE_LABEL[product.textureType]}
                    </td>
                    <td class="num">{product.kcalPer100g} kcal/100g</td>
                    <td class="num">
                      {product.packageAmountG} g
                      {product.packageUnit ? `/${product.packageUnit}` : ""}
                    </td>
                    <td>{target ?? <span class="empty">-</span>}</td>
                    <td class="num">{product.addedCount}</td>
                    <td>{formatDateTime(product.updatedAt)}</td>
                    <td>
                      <div class="actions">
                        <a href={`${productPath(product.id)}/edit`}>編集</a>
                        {/* 確認文には商品名などの入力値を含めない（属性値の中の JS として実行されるため） */}
                        <form
                          method="post"
                          action={`${productPath(product.id)}/delete`}
                          onsubmit="return confirm('この共通のごはん商品を削除しますか？家に追加済みの商品は残ります。')"
                        >
                          <button type="submit" class="danger">
                            削除
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// 選んだ画像をブラウザで長辺 IMAGE_MAX_EDGE px の JPEG に縮小し、ファイル入力欄の中身を
// 差し替える（EXIF の位置情報なども落ちる）。縮小できなかったときはそのまま送り、サーバーの
// 大きさの上限で確かめる。固定の文字列で、利用者の入力は含めない
const RESIZE_SCRIPT = `
document.querySelectorAll('input[type="file"][data-max-edge]').forEach(function (input) {
  input.addEventListener("change", async function () {
    var file = input.files && input.files[0];
    if (!file) return;
    var submit = input.form && input.form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      var maxEdge = Number(input.dataset.maxEdge);
      var bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      var scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      var context = canvas.getContext("2d");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      var blob = await new Promise(function (resolve) {
        canvas.toBlob(resolve, "image/jpeg", 0.85);
      });
      if (!blob) return;
      var transfer = new DataTransfer();
      transfer.items.add(
        new File([blob], file.name.replace(/\\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" })
      );
      input.files = transfer.files;
    } catch (error) {
      console.error(error);
    } finally {
      if (submit) submit.disabled = false;
    }
  });
});
`;

function FieldError(props: { message?: string }) {
  return props.message ? (
    <p class="field-error" role="alert">
      {props.message}
    </p>
  ) : null;
}

export function CatalogFoodProductFormPage(props: {
  /** 編集するときの商品。登録では省略する */
  product?: CatalogFoodProduct;
  input: CatalogFoodProductInput;
  errors?: CatalogFoodProductErrors;
}) {
  const { product, input, errors = {} } = props;
  const action = product ? productPath(product.id) : "/food-products";
  return (
    <>
      <p>
        <a href="/food-products">共通のごはん商品の一覧へ戻る</a>
      </p>
      {Object.keys(errors).length > 0 && (
        <p class="warning" role="alert">
          入力内容を確かめてください。
        </p>
      )}
      <form
        method="post"
        action={action}
        enctype="multipart/form-data"
        class="product-form"
      >
        <label>
          <span>商品名</span>
          <input
            type="text"
            name="name"
            value={input.name}
            required
            maxlength={100}
          />
          <FieldError message={errors.name} />
        </label>
        <label>
          <span>メーカー名（任意）</span>
          <input
            type="text"
            name="manufacturer"
            value={input.manufacturer}
            maxlength={50}
          />
          <FieldError message={errors.manufacturer} />
        </label>
        <label>
          <span>カロリー（kcal/100g）</span>
          <input
            type="number"
            name="kcalPer100g"
            value={input.kcalPer100g}
            required
            min="0"
            step="any"
            inputmode="decimal"
          />
          <FieldError message={errors.kcalPer100g} />
        </label>
        <label>
          <span>内容量（g）</span>
          <input
            type="number"
            name="packageAmountG"
            value={input.packageAmountG}
            required
            min="0"
            step="any"
            inputmode="decimal"
          />
          <FieldError message={errors.packageAmountG} />
        </label>
        <label>
          <span>単位（任意）</span>
          <input
            type="text"
            name="packageUnit"
            value={input.packageUnit}
            placeholder="本・袋・パック"
            maxlength={10}
          />
          <small>
            1本・1袋あたりで登録する場合に入力。未入力は商品全体の内容量
          </small>
          <FieldError message={errors.packageUnit} />
        </label>
        <label>
          <span>区分</span>
          <select name="nutritionType">
            {NUTRITION_TYPES.map((value) => (
              <option value={value} selected={input.nutritionType === value}>
                {NUTRITION_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
          <FieldError message={errors.nutritionType} />
        </label>
        <label>
          <span>種類</span>
          <select name="textureType">
            {TEXTURE_TYPES.map((value) => (
              <option value={value} selected={input.textureType === value}>
                {TEXTURE_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
          <FieldError message={errors.textureType} />
        </label>
        <fieldset>
          <legend>対象の猫（任意・複数選択可）</legend>
          <div class="checkboxes">
            {LIFE_STAGES.map((value) => (
              <label class="checkbox">
                <input
                  type="checkbox"
                  name="lifeStages"
                  value={value}
                  checked={input.lifeStages.includes(value)}
                />
                {LIFE_STAGE_LABEL[value]}
              </label>
            ))}
          </div>
          <FieldError message={errors.lifeStages} />
        </fieldset>
        <label>
          <span>対象の猫種（任意）</span>
          <input
            type="text"
            name="targetBreed"
            value={input.targetBreed}
            maxlength={50}
          />
          <small>
            特定の猫種向けの商品の場合に、メインアプリの猫種と同じ表記で入力。未入力はすべての猫種向け
          </small>
          <FieldError message={errors.targetBreed} />
        </label>
        <label>
          <span>商品画像（任意）</span>
          {product?.imageAssetId && (
            <img
              class="product-image"
              src={`${productPath(product.id)}/image?v=${encodeURIComponent(product.imageAssetId)}`}
              alt="現在の商品画像"
              width={96}
              height={96}
            />
          )}
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            data-max-edge={String(IMAGE_MAX_EDGE)}
          />
          <small>
            選んだ画像は長辺 {IMAGE_MAX_EDGE}px の JPEG に縮小して保存します。
            {product?.imageAssetId && "選ぶと今の画像と差し替えます。"}
          </small>
          <FieldError message={errors.image} />
        </label>
        {product?.imageAssetId && (
          <label class="checkbox">
            <input type="checkbox" name="removeImage" value="1" />
            今の画像を削除する
          </label>
        )}
        <div>
          <button type="submit">{product ? "更新する" : "登録する"}</button>
        </div>
      </form>
      <script dangerouslySetInnerHTML={{ __html: RESIZE_SCRIPT }} />
    </>
  );
}
