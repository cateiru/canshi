"use client";

import { startTransition, useRef } from "react";
import { TbPlus } from "react-icons/tb";
import { Button, DropdownMenu } from "@/components/ui";
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
   * 内容量の候補（`value` は `toPackageSizeValue`）。2 つ以上あるときは追加するボタンの
   * メニューで選ばせ、1 つだけのときはその内容量で追加する
   */
  packageSizes: { value: string; label: string }[];
};

const initialState: AddCatalogFoodProductState = {};

/**
 * 共通のごはん商品を家に追加するボタン。内容量の候補が複数あるときはメニューを開き、
 * 選んだ内容量で追加する。追加できると家のごはん商品一覧へ移動する
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
  const formRef = useRef<HTMLFormElement>(null);

  const addWithPackageSize = (packageSize: string) => {
    const formData = new FormData(formRef.current ?? undefined);
    formData.set("packageSize", packageSize);
    startTransition(() => formAction(formData));
  };

  return (
    <form ref={formRef} action={formAction} className={styles.form}>
      <input type="hidden" name="householdId" value={householdId} />
      {returnToHousehold ? (
        <input type="hidden" name="returnToHousehold" value="1" />
      ) : null}
      {packageSizes.length > 1 ? (
        <DropdownMenu
          label={isPending ? "追加中..." : "追加する"}
          aria-label={`${productName}を追加する`}
          variant="primary"
          leftIcon={TbPlus}
          isDisabled={isPending}
          items={packageSizes.map((size) => ({
            id: size.value,
            label: size.label,
          }))}
          onAction={addWithPackageSize}
        />
      ) : (
        <>
          <input
            type="hidden"
            name="packageSize"
            value={packageSizes[0]?.value ?? ""}
          />
          <Button
            type="submit"
            variant="primary"
            leftIcon={TbPlus}
            isDisabled={isPending}
            aria-label={`${productName}を追加する`}
          >
            {isPending ? "追加中..." : "追加する"}
          </Button>
        </>
      )}
      {state.error ? (
        <p className={styles.errorMessage} role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
