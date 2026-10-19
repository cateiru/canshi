"use client";

import { TbPlus } from "react-icons/tb";
import { Button, Select, type SelectOption } from "@/components/ui";
import { useSubmitActionState } from "@/features/navigation/useSubmitActionState";
import styles from "./AddCatalogFoodProductButton.module.css";
import type { AddCatalogFoodProductState } from "./actions";

type AddCatalogFoodProductButtonProps = {
  /** 追加する共通のごはん商品の ID を束縛した `addCatalogFoodProductAction` */
  action: (
    state: AddCatalogFoodProductState,
    formData: FormData,
  ) => Promise<AddCatalogFoodProductState>;
  householdId: string;
  /** 追加した後に、追加先の家の商品一覧へ戻すか */
  returnToHousehold: boolean;
  productName: string;
  /**
   * 内容量の候補（値は `toPackageSizeValue`）。2 つ以上あるときは選択欄で選ばせ、
   * 1 つだけのときはその内容量で追加する
   */
  packageSizes: SelectOption[];
};

const initialState: AddCatalogFoodProductState = {};

/**
 * 共通のごはん商品を家に追加するボタン。内容量の候補が複数あるときは、追加する内容量も選ぶ。
 * 追加できると家のごはん商品一覧へ移動する
 */
export function AddCatalogFoodProductButton({
  action,
  householdId,
  returnToHousehold,
  productName,
  packageSizes,
}: AddCatalogFoodProductButtonProps) {
  // 追加できたら家のごはん商品一覧へ移動する。検索ページを履歴に残さないよう、直前の履歴が
  // 一覧なら戻る（ほかのフォームの保存後と同じ）
  const [state, formAction, isPending] = useSubmitActionState(
    action,
    initialState,
  );

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="householdId" value={householdId} />
      {returnToHousehold ? (
        <input type="hidden" name="returnToHousehold" value="1" />
      ) : null}
      {packageSizes.length > 1 ? (
        <Select
          name="packageSize"
          label="内容量"
          options={packageSizes}
          defaultSelectedKey={packageSizes[0].value}
          className={styles.packageSize}
        />
      ) : (
        <input
          type="hidden"
          name="packageSize"
          value={packageSizes[0]?.value ?? ""}
        />
      )}
      <Button
        type="submit"
        variant="primary"
        leftIcon={TbPlus}
        isDisabled={isPending}
        aria-label={`${productName}を追加する`}
      >
        {isPending ? "追加中..." : "追加する"}
      </Button>
      {state.error ? (
        <p className={styles.errorMessage} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
