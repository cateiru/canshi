"use client";

import { Select } from "@/components/ui";

type HouseholdFieldProps = {
  /** ユーザーが所属する家（所属した順） */
  households: { id: string; name: string }[];
  /** 選択中の家の ID */
  value: string;
  onChange?: (householdId: string) => void;
  description?: string;
  errorMessage?: string;
};

/**
 * ごはん商品・プリセットなど、家に属するデータの登録先の家を選ぶ欄（`name="householdId"`）。
 * 所属する家が 1 つだけのときは選ぶ必要がないため、選択欄を出さずにその家を送る
 */
export function HouseholdField({
  households,
  value,
  onChange,
  description,
  errorMessage,
}: HouseholdFieldProps) {
  if (households.length <= 1) {
    return <input type="hidden" name="householdId" value={value} />;
  }
  return (
    <Select
      name="householdId"
      label="家"
      options={households.map((household) => ({
        value: household.id,
        label: household.name,
      }))}
      selectedKey={value}
      onSelectionChange={(key) => onChange?.(String(key))}
      description={description}
      errorMessage={errorMessage}
    />
  );
}
