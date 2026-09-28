"use client";

import { useState } from "react";
import { FormField, Select } from "@/components/ui";
import type { Cat } from "@/db/schema";
import styles from "./BirthDateField.module.css";
import {
  type SubmittedBirthDate,
  toBirthDateFormDefaults,
  withSubmittedBirthDate,
} from "./birthDate";
import type { BirthDatePrecision, CatFormFieldErrors } from "./schema";

type BirthDateFieldProps = {
  cat?: Pick<Cat, "birthDate" | "birthDatePrecision">;
  // 入力エラーで戻したときに送信していた、生年月日の入力値
  submitted?: SubmittedBirthDate;
  fieldErrors?: CatFormFieldErrors;
};

const PRECISION_OPTIONS: { value: BirthDatePrecision; label: string }[] = [
  { value: "day", label: "年月日" },
  { value: "month", label: "年月のみ" },
  { value: "year", label: "年のみ" },
];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1}月`,
}));

/**
 * 生年月日の入力欄。生まれた日がはっきりしない猫のために、年のみ・年月のみでも入力できる。
 * 年のみ・年月のみの場合、未入力の月・日は保存時に 1月・1日で補完する（`resolveBirthDate`）。
 * サーバーから返した入力エラーが残っていても直して送り直せるよう、エラーは表示だけにして
 * ブラウザの検証で送信を止めない（`validationBehavior="aria"`）
 */
export function BirthDateField({
  cat,
  submitted,
  fieldErrors,
}: BirthDateFieldProps) {
  const [precision, setPrecision] = useState<BirthDatePrecision>(
    submitted?.precision ?? cat?.birthDatePrecision ?? "day",
  );
  const savedDefaults = toBirthDateFormDefaults(
    cat?.birthDate ?? null,
    cat?.birthDatePrecision ?? "day",
  );
  const defaults = submitted
    ? withSubmittedBirthDate(savedDefaults, submitted)
    : savedDefaults;

  return (
    <div className={styles.field}>
      <Select
        name="birthDatePrecision"
        label="生年月日のわかる範囲"
        options={PRECISION_OPTIONS}
        selectedKey={precision}
        onSelectionChange={(key) => {
          if (key !== null) {
            setPrecision(key as BirthDatePrecision);
          }
        }}
        errorMessage={fieldErrors?.birthDatePrecision?.[0]}
        validationBehavior="aria"
      />
      {precision === "day" ? (
        <FormField
          name="birthDate"
          label="生年月日"
          type="date"
          defaultValue={defaults.birthDate}
          errorMessage={fieldErrors?.birthDate?.[0]}
          validationBehavior="aria"
        />
      ) : (
        <div className={styles.parts}>
          <FormField
            name="birthYear"
            label="生まれた年（西暦）"
            inputMode="numeric"
            maxLength={4}
            placeholder="例: 2020"
            defaultValue={defaults.birthYear}
            errorMessage={fieldErrors?.birthYear?.[0]}
            validationBehavior="aria"
          />
          {precision === "month" ? (
            <Select
              name="birthMonth"
              label="生まれた月"
              options={MONTH_OPTIONS}
              placeholder="選択"
              defaultSelectedKey={defaults.birthMonth}
              errorMessage={fieldErrors?.birthMonth?.[0]}
              validationBehavior="aria"
            />
          ) : null}
        </div>
      )}
      {precision === "day" ? null : (
        <p className={styles.note}>
          わからない月・日は1月・1日として、年齢や誕生日のお祝いに使います。
        </p>
      )}
    </div>
  );
}
