"use client";

import { useActionState } from "react";
import { TbPlus } from "react-icons/tb";
import { Button } from "@/components/ui";
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
};

const initialState: AddCatalogFoodProductState = {};

/** 共通のごはん商品を家に追加するボタン。追加できると家のごはん商品一覧へ移動する */
export function AddCatalogFoodProductButton({
  action,
  householdId,
  returnToHousehold,
  productName,
}: AddCatalogFoodProductButtonProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="householdId" value={householdId} />
      {returnToHousehold ? (
        <input type="hidden" name="returnToHousehold" value="1" />
      ) : null}
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
