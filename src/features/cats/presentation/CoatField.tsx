"use client";

import { useState } from "react";
import { Radio, RadioGroup } from "@/components/ui";
import {
  CAT_COAT_COLORS,
  CAT_COAT_PATTERNS,
  CAT_COAT_WHITE_AMOUNTS,
  type Cat,
  type CatCoatColor,
  type CatCoatPattern,
  type CatCoatWhiteAmount,
} from "@/db/schema";
import { type Coat, formatCoat } from "../domain/coat";
import {
  COAT_COLOR_LABEL,
  COAT_PATTERN_LABEL,
  COAT_WHITE_LABEL,
} from "../domain/labels";
import type { CatFormFieldErrors } from "../domain/schema";
import styles from "./CoatField.module.css";
import { CoatSwatch } from "./CoatSwatch";

type CoatFieldProps = {
  cat?: Cat;
  fieldErrors?: CatFormFieldErrors;
};

/** 未設定の選択肢の値。空文字で送信し、サーバー側で未設定（NULL）として扱う */
const UNSET = "";

/**
 * 毛色・柄の入力欄。ベース色・柄・白い毛の割合をそれぞれプリセットから選び、
 * 選んだ組み合わせを見本で表示する。選択肢の見本も、ほかの項目で選んでいるものに合わせて描く
 */
export function CoatField({ cat, fieldErrors }: CoatFieldProps) {
  const [coatColor, setCoatColor] = useState<string>(cat?.coatColor ?? UNSET);
  const [coatPattern, setCoatPattern] = useState<string>(
    cat?.coatPattern ?? UNSET,
  );
  const [coatWhite, setCoatWhite] = useState<string>(cat?.coatWhite ?? UNSET);

  const coat: Coat = {
    coatColor: (coatColor || null) as CatCoatColor | null,
    coatPattern: (coatPattern || null) as CatCoatPattern | null,
    coatWhite: (coatWhite || null) as CatCoatWhiteAmount | null,
  };

  return (
    <>
      <div className={styles.preview}>
        <CoatSwatch coat={coat} size="lg" />
        <p className={styles.previewLabel}>{formatCoat(coat) ?? "未設定"}</p>
      </div>

      <CoatRadioGroup
        name="coatColor"
        label="ベース色"
        value={coatColor}
        onChange={setCoatColor}
        options={CAT_COAT_COLORS}
        labels={COAT_COLOR_LABEL}
        swatch={(value) => ({
          ...coat,
          coatColor: value,
          coatPattern: null,
          coatWhite: null,
        })}
        errorMessage={fieldErrors?.coatColor?.[0]}
      />
      <CoatRadioGroup
        name="coatPattern"
        label="柄"
        value={coatPattern}
        onChange={setCoatPattern}
        options={CAT_COAT_PATTERNS}
        labels={COAT_PATTERN_LABEL}
        swatch={(value) => ({ ...coat, coatPattern: value, coatWhite: null })}
        errorMessage={fieldErrors?.coatPattern?.[0]}
      />
      <CoatRadioGroup
        name="coatWhite"
        label="白い毛の割合"
        value={coatWhite}
        onChange={setCoatWhite}
        options={CAT_COAT_WHITE_AMOUNTS}
        labels={COAT_WHITE_LABEL}
        swatch={(value) => ({ ...coat, coatWhite: value })}
        errorMessage={fieldErrors?.coatWhite?.[0]}
      />
    </>
  );
}

type CoatRadioGroupProps<T extends string> = {
  name: keyof Coat;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly T[];
  labels: Record<T, string>;
  /** 選択肢に添える見本の毛色・柄 */
  swatch: (value: T) => Coat;
  errorMessage?: string;
};

function CoatRadioGroup<T extends string>({
  name,
  label,
  value,
  onChange,
  options,
  labels,
  swatch,
  errorMessage,
}: CoatRadioGroupProps<T>) {
  return (
    <div className={styles.group}>
      <RadioGroup
        name={name}
        label={label}
        value={value}
        onChange={onChange}
        isInvalid={errorMessage !== undefined}
        optionsClassName={styles.options}
      >
        <Radio value={UNSET} className={styles.option}>
          <CoatSwatch
            coat={{ coatColor: null, coatPattern: null, coatWhite: null }}
          />
          未設定
        </Radio>
        {options.map((option) => (
          <Radio key={option} value={option} className={styles.option}>
            <CoatSwatch coat={swatch(option)} />
            {labels[option]}
          </Radio>
        ))}
      </RadioGroup>
      {errorMessage ? (
        <p className={styles.errorMessage}>{errorMessage}</p>
      ) : null}
    </div>
  );
}
