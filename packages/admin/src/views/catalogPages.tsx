import type { Child } from "hono/jsx";
import {
  type CatalogFoodProductErrors,
  type CatalogFoodProductInput,
  LIFE_STAGES,
  type LifeStage,
  MAX_PACKAGE_SIZES,
  MAX_SEARCH_KEYWORD_LENGTH,
  MAX_SEARCH_KEYWORDS,
  NUTRITION_TYPES,
  type NutritionType,
  type PackageSize,
  type PackageSizeInput,
  TEXTURE_TYPES,
  type TextureType,
} from "../catalog/form";
import { IMAGE_MAX_EDGE } from "../catalog/image";
import type { CatalogFoodProduct } from "../db/catalogFoodProducts";
import { formatDateTime } from "./format";
import {
  PencilIcon,
  PhotoIcon,
  PhotoPlusIcon,
  PlusIcon,
  TrashIcon,
} from "./icons";

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

/**
 * メインアプリの `formatPackageAmount` と同じく「14 g/本」「1.5 kg」（1000g 以上は kg）
 */
function formatPackageSize(size: PackageSize) {
  const amount =
    size.amountG >= 1000
      ? `${Number((size.amountG / 1000).toPrecision(12))} kg`
      : `${size.amountG} g`;
  return `${amount}${size.unit ? `/${size.unit}` : ""}`;
}

function formatTarget(product: CatalogFoodProduct) {
  const parts = [
    product.lifeStages.map((stage) => LIFE_STAGE_LABEL[stage]).join("・"),
    product.targetBreed ?? "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ・ ") : null;
}

/** 一覧の見出しの右に置く登録ボタン（メインアプリのごはん商品一覧と同じ並び） */
export function CatalogFoodProductsActions() {
  return (
    <a href="/food-products/new" class="button-link primary">
      <PlusIcon />
      共通のごはん商品を登録する
    </a>
  );
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
                        <span class="product-image placeholder">
                          <PhotoIcon />
                          <span class="visually-hidden">画像なし</span>
                        </span>
                      )}
                    </td>
                    <td>
                      <span class="product-name">{product.name}</span>
                      {product.manufacturer && (
                        <span class="sub">{product.manufacturer}</span>
                      )}
                      {product.searchKeywords.length > 0 && (
                        <span class="sub">
                          検索キーワード：{product.searchKeywords.join("、")}
                        </span>
                      )}
                      <code>{product.id}</code>
                    </td>
                    <td class="nowrap">
                      {NUTRITION_TYPE_LABEL[product.nutritionType]}
                      <br />
                      {TEXTURE_TYPE_LABEL[product.textureType]}
                    </td>
                    <td class="num">{product.kcalPer100g} kcal/100g</td>
                    <td class="num">
                      {product.packageSizes.map((size) => (
                        <span class="package-size">
                          {formatPackageSize(size)}
                        </span>
                      ))}
                    </td>
                    <td>{target ?? <span class="empty">-</span>}</td>
                    <td class="num">{product.addedCount}</td>
                    <td>{formatDateTime(product.updatedAt)}</td>
                    <td>
                      <div class="actions">
                        <a
                          href={`${productPath(product.id)}/edit`}
                          class="icon-button"
                          aria-label={`${product.name}を編集する`}
                          title="編集する"
                        >
                          <PencilIcon />
                        </a>
                        {/* 確認文には商品名などの入力値を含めない（属性値の中の JS として実行されるため） */}
                        <form
                          method="post"
                          action={`${productPath(product.id)}/delete`}
                          onsubmit="return confirm('この共通のごはん商品を削除しますか？家に追加済みの商品は残ります。')"
                        >
                          <button
                            type="submit"
                            class="icon-button"
                            aria-label={`${product.name}を削除する`}
                            title="削除する"
                          >
                            <TrashIcon />
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

// 選んだ画像の切り抜く範囲をダイアログで選ばせ、一辺 IMAGE_MAX_EDGE px 以下の正方形の JPEG に
// 切り抜いてファイル入力欄の中身を差し替える（EXIF の位置情報なども落ちる）。キャンセルしたとき・
// 切り抜けなかったときは選んだ画像を外す（元のまま送られても、サーバーが切り抜いた形かを確かめて
// 断る。catalog/image.ts）。切り抜きが終わるまでは送信ボタンを押せなくする。画像の読み込み中に
// 選び直したときは、最後に選んだ画像だけを切り抜く。固定の文字列で、利用者の入力は含めない
const CROP_SCRIPT = `
(function () {
  var dialog = document.querySelector("[data-crop-dialog]");
  if (!dialog) return;
  var canvas = dialog.querySelector("[data-crop-canvas]");
  var zoomInput = dialog.querySelector("[data-crop-zoom]");
  var context = canvas.getContext("2d");
  var maxZoom = Number(zoomInput.max);
  // 切り抜き中の元画像と、切り抜く正方形の中心（元画像の px）・ズーム倍率
  var state = null;
  var drag = null;

  // 切り抜く正方形の一辺（元画像の px）。ズーム 1 倍で短辺いっぱいになる
  function cropSide() {
    return Math.min(state.bitmap.width, state.bitmap.height) / state.zoom;
  }
  function clampCenter() {
    var half = cropSide() / 2;
    state.centerX = Math.min(state.bitmap.width - half, Math.max(half, state.centerX));
    state.centerY = Math.min(state.bitmap.height - half, Math.max(half, state.centerY));
  }
  function cropRect() {
    var side = cropSide();
    return { x: state.centerX - side / 2, y: state.centerY - side / 2, side: side };
  }
  function draw() {
    var rect = cropRect();
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(state.bitmap, rect.x, rect.y, rect.side, rect.side, 0, 0, canvas.width, canvas.height);
  }
  function setZoom(zoom) {
    state.zoom = Math.min(maxZoom, Math.max(1, zoom));
    zoomInput.value = String(state.zoom);
    clampCenter();
    draw();
  }
  // 画面上の移動量（CSS px）だけ画像を動かす
  function pan(dx, dy) {
    var ratio = cropSide() / canvas.getBoundingClientRect().width;
    state.centerX -= dx * ratio;
    state.centerY -= dy * ratio;
    clampCenter();
    draw();
  }

  canvas.addEventListener("pointerdown", function (event) {
    if (!state) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", function (event) {
    if (!state || !drag || drag.id !== event.pointerId) return;
    pan(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  function endDrag(event) {
    if (drag && drag.id === event.pointerId) drag = null;
  }
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", function (event) {
    if (!state) return;
    event.preventDefault();
    setZoom(state.zoom * Math.exp(-event.deltaY * 0.002));
  }, { passive: false });
  // 矢印キーでも画像を動かせるようにする（Shift で大きく動かす）
  canvas.addEventListener("keydown", function (event) {
    if (!state) return;
    var step = event.shiftKey ? 40 : 10;
    var moves = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    var move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    pan(move[0], move[1]);
  });
  zoomInput.addEventListener("input", function () {
    if (state) setZoom(Number(zoomInput.value));
  });
  dialog.querySelector("[data-crop-confirm]").addEventListener("click", function () {
    dialog.close("confirm");
  });
  dialog.querySelector("[data-crop-cancel]").addEventListener("click", function () {
    dialog.close("cancel");
  });

  // 範囲を選ばせ、決定したら切り抜く範囲（元画像の px）、キャンセルしたら null を返す
  function chooseCropRect(bitmap) {
    state = { bitmap: bitmap, zoom: 1, centerX: bitmap.width / 2, centerY: bitmap.height / 2 };
    zoomInput.value = "1";
    draw();
    // Esc で閉じたときは returnValue が変わらないため、前回の値を消しておく
    dialog.returnValue = "";
    dialog.showModal();
    return new Promise(function (resolve) {
      dialog.addEventListener("close", function () {
        var rect = dialog.returnValue === "confirm" ? cropRect() : null;
        state = null;
        drag = null;
        resolve(rect);
      }, { once: true });
    });
  }

  function exportJpeg(bitmap, rect, maxEdge) {
    var size = Math.max(1, Math.min(maxEdge, Math.round(rect.side)));
    var output = document.createElement("canvas");
    output.width = size;
    output.height = size;
    var outputContext = output.getContext("2d");
    outputContext.fillStyle = "#fff";
    outputContext.fillRect(0, 0, size, size);
    outputContext.imageSmoothingQuality = "high";
    outputContext.drawImage(bitmap, rect.x, rect.y, rect.side, rect.side, 0, 0, size, size);
    return new Promise(function (resolve) {
      output.toBlob(resolve, "image/jpeg", 0.85);
    });
  }

  document.querySelectorAll('input[type="file"][data-max-edge]').forEach(function (input) {
    // 何回目に選んだ画像か。読み込みを待つ間に選び直されたら、古い画像は切り抜かない
    var selection = 0;
    var field = input.closest(".field");
    var cropError = field && field.querySelector("[data-crop-error]");
    var fileName = field && field.querySelector("[data-file-name]");
    var preview = field && field.querySelector("[data-crop-preview]");
    var submit = input.form && input.form.querySelector('button[type="submit"]');

    function showPreview(blob) {
      if (!preview) return;
      if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      preview.dataset.objectUrl = blob ? URL.createObjectURL(blob) : "";
      if (blob) preview.src = preview.dataset.objectUrl;
      else preview.removeAttribute("src");
      preview.hidden = !blob;
    }
    function clearSelection() {
      input.value = "";
      if (fileName) fileName.textContent = fileName.dataset.fileName;
      showPreview(null);
    }

    input.addEventListener("change", async function () {
      var current = ++selection;
      var file = input.files && input.files[0];
      if (cropError) cropError.hidden = true;
      // 選び直しで選択を取り消したときは、切り抜いた前の画像の分も含めて元に戻す
      if (!file) {
        clearSelection();
        if (submit) submit.disabled = false;
        return;
      }
      if (submit) submit.disabled = true;
      var bitmap = null;
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        if (current !== selection) return;
        var rect = await chooseCropRect(bitmap);
        if (!rect) {
          clearSelection();
          return;
        }
        var blob = await exportJpeg(bitmap, rect, Number(input.dataset.maxEdge));
        if (!blob) throw new Error("JPEG に書き出せませんでした");
        var transfer = new DataTransfer();
        transfer.items.add(
          new File([blob], file.name.replace(/\\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" })
        );
        input.files = transfer.files;
        if (fileName) fileName.textContent = file.name;
        showPreview(blob);
      } catch (error) {
        if (current !== selection) return;
        console.error(error);
        clearSelection();
        if (cropError) cropError.hidden = false;
      } finally {
        if (bitmap) bitmap.close();
        if (current === selection && submit) submit.disabled = false;
      }
    });
  });
})();
`;

function FieldError(props: { id: string; message?: string }) {
  return props.message ? (
    <p class="field-error" id={props.id} role="alert">
      {props.message}
    </p>
  ) : null;
}

/** 入力欄の補足説明（メインアプリの FieldDescription） */
function FieldDescription(props: { id: string; children: Child }) {
  return (
    <p class="field-description" id={props.id}>
      {props.children}
    </p>
  );
}

type TextFieldName = "name" | "manufacturer" | "kcalPer100g" | "targetBreed";

/** メインアプリの FormField と同じく、ラベル・入力欄・補足説明・エラーを縦に並べる */
function TextField(props: {
  name: TextFieldName;
  label: string;
  input: CatalogFoodProductInput;
  errors: CatalogFoodProductErrors;
  description?: string;
  type?: "text" | "number";
  required?: boolean;
  maxlength?: number;
  placeholder?: string;
}) {
  const { name, errors } = props;
  const id = `field-${name}`;
  const error = errors[name];
  const describedBy = [
    props.description ? `${id}-description` : "",
    error ? `${id}-error` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div class="field">
      <label for={id}>{props.label}</label>
      <input
        id={id}
        type={props.type ?? "text"}
        name={name}
        value={props.input[name]}
        required={props.required}
        maxlength={props.maxlength}
        placeholder={props.placeholder}
        {...(props.type === "number"
          ? { min: "0", step: "any", inputmode: "decimal" }
          : {})}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy || undefined}
      />
      {props.description && (
        <FieldDescription id={`${id}-description`}>
          {props.description}
        </FieldDescription>
      )}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** 検索キーワードの入力欄。1 行に 1 語を入力する */
function SearchKeywordsField(props: {
  input: CatalogFoodProductInput;
  errors: CatalogFoodProductErrors;
}) {
  const id = "field-searchKeywords";
  const error = props.errors.searchKeywords;
  return (
    <div class="field">
      <label for={id}>検索キーワード（任意）</label>
      <textarea
        id={id}
        name="searchKeywords"
        rows={3}
        placeholder={"ちゅーる\nちゃおちゅーる"}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={[`${id}-description`, error ? `${id}-error` : ""]
          .filter(Boolean)
          .join(" ")}
      >
        {props.input.searchKeywords}
      </textarea>
      <FieldDescription id={`${id}-description`}>
        商品名・メーカー名とは別の呼び方を、1行に1語ずつ入力（
        {MAX_SEARCH_KEYWORDS}
        件・1語{MAX_SEARCH_KEYWORD_LENGTH}
        文字まで）。キーワードの一部で検索しても見つかります。
      </FieldDescription>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function SelectField<T extends string>(props: {
  name: "nutritionType" | "textureType";
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  input: CatalogFoodProductInput;
  errors: CatalogFoodProductErrors;
}) {
  const { name, errors } = props;
  const id = `field-${name}`;
  const error = errors[name];
  return (
    <div class="field">
      <label for={id}>{props.label}</label>
      <select
        id={id}
        name={name}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        {props.options.map((value) => (
          <option value={value} selected={props.input[name] === value}>
            {props.labels[value]}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

// 内容量の候補の行を追加・削除する。追加は <template> の空の行を複製し、入力欄の ID が重ならないよう
// 行の番号（__INDEX__）を振り直す。削除は行が 1 つだけのときは入力を消すだけにする。
// 上限まで並んだら追加ボタンを押せなくする。固定の文字列で、利用者の入力は含めない
const PACKAGE_SIZES_SCRIPT = `
document.querySelectorAll("[data-package-sizes]").forEach(function (field) {
  var list = field.querySelector("[data-package-size-rows]");
  var template = field.querySelector("template");
  var add = field.querySelector("[data-add-package-size]");
  var max = Number(field.dataset.max);
  var next = list.children.length;
  function update() {
    add.disabled = list.children.length >= max;
  }
  add.addEventListener("click", function () {
    var holder = document.createElement("div");
    holder.innerHTML = template.innerHTML.replace(/__INDEX__/g, String(next++));
    var row = holder.firstElementChild;
    list.appendChild(row);
    row.querySelector("input").focus();
    update();
  });
  list.addEventListener("click", function (event) {
    var button = event.target.closest("[data-remove-package-size]");
    if (!button) return;
    var row = button.closest("[data-package-size-row]");
    if (list.children.length > 1) {
      row.remove();
      add.focus();
    } else {
      row.querySelectorAll("input").forEach(function (input) {
        input.value = "";
      });
    }
    update();
  });
  update();
});
`;

/** 内容量の候補の 1 行（g・単位・削除ボタン） */
function PackageSizeRow(props: {
  index: number | "__INDEX__";
  row: PackageSizeInput;
  errors?: Partial<Record<keyof PackageSizeInput, string>>;
}) {
  const { index, row, errors = {} } = props;
  const amountId = `field-packageAmountG-${index}`;
  const unitId = `field-packageUnit-${index}`;
  return (
    <div class="package-size-row" data-package-size-row>
      <div class="field">
        <label for={amountId}>内容量（g）</label>
        <input
          id={amountId}
          type="number"
          name="packageAmountG"
          value={row.amountG}
          min="0"
          step="any"
          inputmode="decimal"
          aria-invalid={errors.amountG ? "true" : undefined}
          aria-describedby={errors.amountG ? `${amountId}-error` : undefined}
        />
        <FieldError id={`${amountId}-error`} message={errors.amountG} />
      </div>
      <div class="field">
        <label for={unitId}>単位（任意）</label>
        <input
          id={unitId}
          type="text"
          name="packageUnit"
          value={row.unit}
          maxlength={10}
          placeholder="本・袋・パック"
          aria-invalid={errors.unit ? "true" : undefined}
          aria-describedby={errors.unit ? `${unitId}-error` : undefined}
        />
        <FieldError id={`${unitId}-error`} message={errors.unit} />
      </div>
      {/* 削除ボタンを入力欄と同じ高さに揃えるため、ラベルと同じ高さの空きを置く */}
      <div class="field">
        <span class="field-label" aria-hidden="true">
          &nbsp;
        </span>
        <button
          type="button"
          class="icon-button"
          data-remove-package-size
          aria-label="この内容量を削除する"
          title="削除する"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

/**
 * 内容量の候補の入力欄。g と単位の行を並べ、メインアプリで家に追加するときにこの中から 1 つ選ぶ。
 * 空の行は保存しない
 */
function PackageSizesField(props: {
  rows: PackageSizeInput[];
  error?: string;
  rowErrors?: Partial<Record<keyof PackageSizeInput, string>>[];
}) {
  return (
    <fieldset
      class="group"
      data-package-sizes
      data-max={String(MAX_PACKAGE_SIZES)}
      aria-describedby="field-packageSizes-description"
    >
      <legend>内容量</legend>
      <div class="package-size-rows" data-package-size-rows>
        {props.rows.map((row, index) => (
          <PackageSizeRow
            index={index}
            row={row}
            errors={props.rowErrors?.[index]}
          />
        ))}
      </div>
      <template>
        <PackageSizeRow index="__INDEX__" row={{ amountG: "", unit: "" }} />
      </template>
      <div>
        <button type="button" class="with-icon" data-add-package-size>
          <PlusIcon />
          内容量を追加する
        </button>
      </div>
      <FieldDescription id="field-packageSizes-description">
        容量違いの商品は、内容量を追加して1つの商品にまとめます（
        {MAX_PACKAGE_SIZES}
        件まで）。家に追加するときにこの中から選び、先頭の内容量が最初に選ばれます。単位は1本・1袋あたりで登録する場合に入力し、未入力は商品全体の内容量です。
      </FieldDescription>
      <FieldError id="field-packageSizes-error" message={props.error} />
    </fieldset>
  );
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
        <TextField
          name="name"
          label="商品名"
          input={input}
          errors={errors}
          required
          maxlength={100}
        />
        <TextField
          name="manufacturer"
          label="メーカー名（任意）"
          input={input}
          errors={errors}
          maxlength={50}
        />
        <TextField
          name="kcalPer100g"
          label="カロリー（kcal/100g）"
          type="number"
          input={input}
          errors={errors}
          required
        />
        <PackageSizesField
          rows={input.packageSizes}
          error={errors.packageSizes}
          rowErrors={errors.packageSizeRows}
        />
        <SelectField
          name="nutritionType"
          label="区分"
          options={NUTRITION_TYPES}
          labels={NUTRITION_TYPE_LABEL}
          input={input}
          errors={errors}
        />
        <SelectField
          name="textureType"
          label="種類"
          options={TEXTURE_TYPES}
          labels={TEXTURE_TYPE_LABEL}
          input={input}
          errors={errors}
        />
        {/* メインアプリの FormGroup と同じく、淡い背景の面にチェックボックスをまとめる */}
        <fieldset class="group">
          <legend>対象の猫（任意）</legend>
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
          <FieldDescription id="field-lifeStages-description">
            複数選択できます。
          </FieldDescription>
          <FieldError id="field-lifeStages-error" message={errors.lifeStages} />
        </fieldset>
        <TextField
          name="targetBreed"
          label="対象の猫種（任意）"
          description="特定の猫種向けの商品の場合に、メインアプリの猫種と同じ表記で入力。未入力はすべての猫種向け"
          input={input}
          errors={errors}
          maxlength={50}
        />
        <SearchKeywordsField input={input} errors={errors} />
        <div class="field">
          <span class="field-label" id="field-image-label">
            商品画像（任意）
          </span>
          <div class="image-field">
            {product?.imageAssetId && (
              <img
                class="product-image current-image"
                src={`${productPath(product.id)}/image?v=${encodeURIComponent(product.imageAssetId)}`}
                alt="今の商品画像"
                width={160}
                height={160}
              />
            )}
            <img
              class="product-image current-image"
              alt="切り抜いた商品画像"
              width={160}
              height={160}
              data-crop-preview
              hidden
            />
            {/* メインアプリの画像の選択欄と同じ見た目の点線の枠。ファイル入力欄を枠いっぱいに
                重ねて透明にし、押す・ドラッグ＆ドロップのどちらでも選べるようにする */}
            <label class="file-chooser">
              <input
                type="file"
                name="image"
                accept="image/jpeg,image/png,image/webp"
                data-max-edge={String(IMAGE_MAX_EDGE)}
                aria-labelledby="field-image-label"
                aria-describedby="field-image-description"
              />
              <PhotoPlusIcon />
              <span class="file-chooser-title">
                {product?.imageAssetId ? "画像を差し替える" : "画像を選ぶ"}
              </span>
              <span
                class="file-chooser-note"
                data-file-name="またはここにドラッグ＆ドロップ"
              >
                またはここにドラッグ＆ドロップ
              </span>
            </label>
          </div>
          <FieldDescription id="field-image-description">
            選んだ画像は正方形に切り抜き、一辺 {IMAGE_MAX_EDGE}px 以下の JPEG
            にして保存します。
          </FieldDescription>
          <p class="field-error" role="alert" data-crop-error hidden>
            画像を切り抜けませんでした。別の画像を選んでください。
          </p>
          <FieldError id="field-image-error" message={errors.image} />
          {product?.imageAssetId && (
            <label class="checkbox">
              <input type="checkbox" name="removeImage" value="1" />
              今の画像を削除する
            </label>
          )}
        </div>
        <button type="submit" class="primary">
          {product ? "更新する" : "登録する"}
        </button>
      </form>
      {/* 商品画像を選んだときに開く、切り抜く範囲を選ぶダイアログ（CROP_SCRIPT が操作する） */}
      <dialog
        class="crop-dialog"
        aria-labelledby="crop-dialog-title"
        aria-describedby="crop-dialog-description"
        data-crop-dialog
      >
        <h2 id="crop-dialog-title">商品画像の範囲を選ぶ</h2>
        <p class="field-description" id="crop-dialog-description">
          ドラッグ・矢印キーで位置を調整、ホイール・スライダーでズーム
        </p>
        <canvas
          class="crop-canvas"
          width={640}
          height={640}
          tabindex={0}
          role="img"
          aria-label="切り抜く範囲"
          data-crop-canvas
        />
        <label class="crop-zoom">
          ズーム
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value="1"
            data-crop-zoom
          />
        </label>
        <div class="crop-actions">
          <button type="button" class="primary" data-crop-confirm>
            この範囲で決定する
          </button>
          <button type="button" data-crop-cancel>
            キャンセル
          </button>
        </div>
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: CROP_SCRIPT }} />
      <script dangerouslySetInnerHTML={{ __html: PACKAGE_SIZES_SCRIPT }} />
    </>
  );
}
