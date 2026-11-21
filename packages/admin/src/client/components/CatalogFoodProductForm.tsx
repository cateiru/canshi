import {
  Alert,
  Button,
  Checkbox,
  FormField,
  FormGroup,
  IconButton,
  Select,
  Textarea,
} from "@canshi/shared/ui";
import { useEffect, useId, useRef, useState } from "react";
import { TbPhotoPlus, TbPlus, TbTrash } from "react-icons/tb";
import type {
  CatalogFoodProductInvalidResponse,
  CatalogFoodProductJson,
  CatalogFoodProductSavedResponse,
} from "../../api/types";
import {
  type CatalogFoodProductErrors,
  type CatalogFoodProductInput,
  LIFE_STAGES,
  MAX_PACKAGE_SIZES,
  MAX_SEARCH_KEYWORD_LENGTH,
  MAX_SEARCH_KEYWORDS,
  NUTRITION_TYPES,
  type PackageSizeInput,
  TEXTURE_TYPES,
} from "../../catalog/form";
import { IMAGE_MAX_EDGE } from "../../catalog/image";
import { ApiError, segment, sendForm } from "../api";
import common from "../common.module.css";
import {
  LIFE_STAGE_LABEL,
  NUTRITION_TYPE_LABEL,
  TEXTURE_TYPE_LABEL,
} from "../format";
import styles from "./CatalogFoodProductForm.module.css";
import { ImageCropModal } from "./ImageCropModal";

/** 内容量の候補の行。並べ替え・削除で入力欄を取り違えないよう、行ごとに key を持たせる */
type PackageSizeRow = PackageSizeInput & { key: number };

const NUTRITION_TYPE_OPTIONS = NUTRITION_TYPES.map((value) => ({
  value,
  label: NUTRITION_TYPE_LABEL[value],
}));

const TEXTURE_TYPE_OPTIONS = TEXTURE_TYPES.map((value) => ({
  value,
  label: TEXTURE_TYPE_LABEL[value],
}));

/** どちらも空の行は送らない（サーバーも捨てる）。1 行もなければ空の行を 1 つ置く */
function withoutEmptyRows(rows: PackageSizeRow[], nextKey: () => number) {
  const filled = rows.filter(
    (row) => row.amountG.trim() !== "" || row.unit.trim() !== "",
  );
  return filled.length > 0
    ? filled
    : [{ amountG: "", unit: "", key: nextKey() }];
}

/** 内容量の候補の入力欄。g と単位の行を並べ、メインアプリで家に追加するときにこの中から 1 つ選ぶ */
function PackageSizesField(props: {
  rows: PackageSizeRow[];
  onChange: (rows: PackageSizeRow[]) => void;
  nextKey: () => number;
  error?: string;
  rowErrors?: CatalogFoodProductErrors["packageSizeRows"];
  isDisabled: boolean;
}) {
  const { rows, onChange } = props;
  const update = (key: number, patch: Partial<PackageSizeInput>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <FormGroup
      legend="内容量"
      description={`容量違いの商品は、内容量を追加して1つの商品にまとめます（${MAX_PACKAGE_SIZES}件まで）。家に追加するときにこの中から選び、先頭の内容量が最初に選ばれます。単位は1本・1袋あたりで登録する場合に入力し、未入力は商品全体の内容量です。`}
      errorMessage={props.error}
    >
      <div className={styles.packageSizeRows}>
        {rows.map((row, index) => {
          const rowErrors = props.rowErrors?.[index] ?? {};
          return (
            <div key={row.key} className={styles.packageSizeRow}>
              <FormField
                label="内容量（g）"
                inputMode="decimal"
                value={row.amountG}
                onChange={(amountG) => update(row.key, { amountG })}
                errorMessage={rowErrors.amountG}
                isDisabled={props.isDisabled}
              />
              <FormField
                label="単位（任意）"
                value={row.unit}
                onChange={(unit) => update(row.key, { unit })}
                maxLength={10}
                placeholder="本・袋・パック"
                errorMessage={rowErrors.unit}
                isDisabled={props.isDisabled}
              />
              <IconButton
                icon={TbTrash}
                aria-label="この内容量を削除する"
                className={styles.removeButton}
                isDisabled={props.isDisabled}
                onPress={() => {
                  // 行が 1 つだけのときは入力を消すだけにする
                  if (rows.length > 1) {
                    onChange(rows.filter((item) => item.key !== row.key));
                  } else {
                    update(row.key, { amountG: "", unit: "" });
                  }
                }}
              />
            </div>
          );
        })}
      </div>
      <div>
        <Button
          variant="secondary"
          leftIcon={TbPlus}
          isDisabled={props.isDisabled || rows.length >= MAX_PACKAGE_SIZES}
          onPress={() =>
            onChange([...rows, { amountG: "", unit: "", key: props.nextKey() }])
          }
        >
          内容量を追加する
        </Button>
      </div>
    </FormGroup>
  );
}

/**
 * 商品画像の選択欄。選んだ画像は切り抜くダイアログで正方形に切り抜き、一辺 `IMAGE_MAX_EDGE` px 以下の
 * JPEG にしてから送る（サーバーも切り抜いた形かを確かめ、元のまま届いた画像は断る。catalog/image.ts）
 */
function ImageField(props: {
  currentImageUrl: string | null;
  image: File | null;
  onImageChange: (image: File | null) => void;
  removeImage: boolean;
  onRemoveImageChange: (removeImage: boolean) => void;
  onCroppingChange: (isCropping: boolean) => void;
  error?: string;
  isDisabled: boolean;
}) {
  const labelId = useId();
  const descriptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { image, onCroppingChange } = props;

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    onCroppingChange(cropSource !== null);
  }, [cropSource, onCroppingChange]);

  /** 選んだファイルを外す（同じファイルを選び直しても change が届くようにする） */
  const clearInput = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className={styles.imageField}>
      <span className={styles.label} id={labelId}>
        商品画像（任意）
      </span>
      <div className={styles.images}>
        {props.currentImageUrl && !previewUrl ? (
          <img
            className={styles.image}
            src={props.currentImageUrl}
            alt="今の商品画像"
            width={160}
            height={160}
          />
        ) : null}
        {previewUrl ? (
          <img
            className={styles.image}
            src={previewUrl}
            alt="切り抜いた商品画像"
            width={160}
            height={160}
          />
        ) : null}
        {/* メインアプリの画像の選択欄と同じ見た目の点線の枠。ファイル入力欄を枠いっぱいに
            重ねて透明にし、押す・ドラッグ＆ドロップのどちらでも選べるようにする */}
        <label className={styles.fileChooser}>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-labelledby={labelId}
            aria-describedby={descriptionId}
            disabled={props.isDisabled}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              clearInput();
              if (file) {
                setCropSource(file);
              }
            }}
          />
          <TbPhotoPlus size={26} aria-hidden="true" />
          <span className={styles.fileChooserTitle}>
            {props.currentImageUrl || image ? "画像を差し替える" : "画像を選ぶ"}
          </span>
          <span className={styles.fileChooserNote}>
            {image ? image.name : "またはここにドラッグ＆ドロップ"}
          </span>
        </label>
      </div>
      <p className={styles.description} id={descriptionId}>
        選んだ画像は正方形に切り抜き、一辺 {IMAGE_MAX_EDGE}px 以下の JPEG
        にして保存します。
      </p>
      {props.error ? (
        <p className={styles.error} role="alert">
          {props.error}
        </p>
      ) : null}
      {image ? (
        <div>
          <Button
            variant="ghost"
            isDisabled={props.isDisabled}
            onPress={() => props.onImageChange(null)}
          >
            選んだ画像をやめる
          </Button>
        </div>
      ) : null}
      {props.currentImageUrl ? (
        <Checkbox
          isSelected={props.removeImage}
          onChange={props.onRemoveImageChange}
          isDisabled={props.isDisabled}
        >
          今の画像を削除する
        </Checkbox>
      ) : null}
      <ImageCropModal
        file={cropSource}
        maxEdge={IMAGE_MAX_EDGE}
        onClose={() => setCropSource(null)}
        onCropped={(cropped) => {
          setCropSource(null);
          props.onImageChange(cropped);
        }}
      />
    </div>
  );
}

/** 入力値をフォームの項目にする（項目名はサーバーの catalog/form.ts の解析に合わせる） */
function toFormData(
  input: CatalogFoodProductInput,
  image: File | null,
  removeImage: boolean,
) {
  const body = new FormData();
  body.set("name", input.name);
  body.set("manufacturer", input.manufacturer);
  body.set("kcalPer100g", input.kcalPer100g);
  for (const row of input.packageSizes) {
    body.append("packageAmountG", row.amountG);
    body.append("packageUnit", row.unit);
  }
  body.set("nutritionType", input.nutritionType);
  body.set("textureType", input.textureType);
  for (const stage of input.lifeStages) {
    body.append("lifeStages", stage);
  }
  body.set("targetBreed", input.targetBreed);
  body.set("searchKeywords", input.searchKeywords);
  if (image) {
    body.set("image", image);
  }
  if (removeImage) {
    body.set("removeImage", "1");
  }
  return body;
}

/** 共通のごはん商品の登録・編集フォーム */
export function CatalogFoodProductForm(props: {
  /** 編集するときの商品。登録では省略する */
  product?: CatalogFoodProductJson;
  /** 現在の商品画像の URL。画像がなければ null */
  currentImageUrl?: string | null;
  initialInput: CatalogFoodProductInput;
  onSaved: (id: string) => void;
}) {
  const { product } = props;
  const keyRef = useRef(0);
  const nextKey = () => {
    keyRef.current += 1;
    return keyRef.current;
  };
  const [input, setInput] = useState(props.initialInput);
  const [rows, setRows] = useState<PackageSizeRow[]>(() =>
    props.initialInput.packageSizes.map((row) => ({ ...row, key: nextKey() })),
  );
  const [errors, setErrors] = useState<CatalogFoodProductErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isCropping, setIsCropping] = useState(false);

  const set = <K extends keyof CatalogFoodProductInput>(
    key: K,
    value: CatalogFoodProductInput[K],
  ) => setInput((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    // サーバーが返す行ごとのエラーと並びを揃えるため、空の行を先に除く
    const sentRows = withoutEmptyRows(rows, nextKey);
    setRows(sentRows);
    const body = toFormData(
      {
        ...input,
        packageSizes: sentRows.map(({ amountG, unit }) => ({ amountG, unit })),
      },
      image,
      removeImage,
    );
    setIsPending(true);
    setFormError(null);
    try {
      const { id } = product
        ? await sendForm<CatalogFoodProductSavedResponse>(
            "PUT",
            `/food-products/${segment(product.id)}`,
            body,
          )
        : await sendForm<CatalogFoodProductSavedResponse>(
            "POST",
            "/food-products",
            body,
          );
      props.onSaved(id);
    } catch (error) {
      const invalid =
        error instanceof ApiError &&
        typeof error.body === "object" &&
        error.body !== null &&
        "errors" in error.body
          ? (error.body as CatalogFoodProductInvalidResponse)
          : null;
      setErrors(invalid?.errors ?? {});
      setFormError(
        invalid
          ? "入力内容を確かめてください。"
          : error instanceof Error
            ? error.message
            : "保存できませんでした",
      );
      setIsPending(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {formError ? (
        <Alert color="error" role="alert">
          {formError}
        </Alert>
      ) : null}
      <FormField
        label="商品名"
        value={input.name}
        onChange={(value) => set("name", value)}
        isRequired
        maxLength={100}
        errorMessage={errors.name}
        isDisabled={isPending}
      />
      <FormField
        label="メーカー名（任意）"
        value={input.manufacturer}
        onChange={(value) => set("manufacturer", value)}
        maxLength={50}
        errorMessage={errors.manufacturer}
        isDisabled={isPending}
      />
      <FormField
        label="カロリー（kcal/100g）"
        inputMode="decimal"
        value={input.kcalPer100g}
        onChange={(value) => set("kcalPer100g", value)}
        isRequired
        errorMessage={errors.kcalPer100g}
        isDisabled={isPending}
      />
      <PackageSizesField
        rows={rows}
        onChange={setRows}
        nextKey={nextKey}
        error={errors.packageSizes}
        rowErrors={errors.packageSizeRows}
        isDisabled={isPending}
      />
      <Select
        label="区分"
        options={NUTRITION_TYPE_OPTIONS}
        selectedKey={input.nutritionType}
        onSelectionChange={(key) => set("nutritionType", String(key))}
        errorMessage={errors.nutritionType}
        isDisabled={isPending}
      />
      <Select
        label="種類"
        options={TEXTURE_TYPE_OPTIONS}
        selectedKey={input.textureType}
        onSelectionChange={(key) => set("textureType", String(key))}
        errorMessage={errors.textureType}
        isDisabled={isPending}
      />
      <FormGroup
        legend="対象の猫（任意）"
        description="複数選択できます。"
        errorMessage={errors.lifeStages}
      >
        <div className={styles.checkboxes}>
          {LIFE_STAGES.map((stage) => (
            <Checkbox
              key={stage}
              isSelected={input.lifeStages.includes(stage)}
              isDisabled={isPending}
              onChange={(selected) =>
                set(
                  "lifeStages",
                  // 選んだ順ではなく決まった順にする
                  LIFE_STAGES.filter((item) =>
                    item === stage ? selected : input.lifeStages.includes(item),
                  ),
                )
              }
            >
              {LIFE_STAGE_LABEL[stage]}
            </Checkbox>
          ))}
        </div>
      </FormGroup>
      <FormField
        label="対象の猫種（任意）"
        description="特定の猫種向けの商品の場合に、メインアプリの猫種と同じ表記で入力。未入力はすべての猫種向け"
        value={input.targetBreed}
        onChange={(value) => set("targetBreed", value)}
        maxLength={50}
        errorMessage={errors.targetBreed}
        isDisabled={isPending}
      />
      <Textarea
        label="検索キーワード（任意）"
        description={`商品名・メーカー名とは別の呼び方を、1行に1語ずつ入力（${MAX_SEARCH_KEYWORDS}件・1語${MAX_SEARCH_KEYWORD_LENGTH}文字まで）。キーワードの一部で検索しても見つかります。`}
        rows={3}
        placeholder={"ちゅーる\nちゃおちゅーる"}
        value={input.searchKeywords}
        onChange={(value) => set("searchKeywords", value)}
        errorMessage={errors.searchKeywords}
        isDisabled={isPending}
      />
      <ImageField
        currentImageUrl={props.currentImageUrl ?? null}
        image={image}
        onImageChange={setImage}
        removeImage={removeImage}
        onRemoveImageChange={setRemoveImage}
        onCroppingChange={setIsCropping}
        error={errors.image}
        isDisabled={isPending}
      />
      <div>
        <Button
          type="submit"
          variant="primary"
          isDisabled={isPending || isCropping}
          className={common.nowrap}
        >
          {isPending ? "保存中..." : product ? "更新する" : "登録する"}
        </Button>
      </div>
    </form>
  );
}
