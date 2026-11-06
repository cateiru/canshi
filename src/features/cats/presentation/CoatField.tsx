"use client";

import { useState } from "react";
import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  Label,
} from "react-aria-components";
import { TbCheck } from "react-icons/tb";
import { RadioGroup } from "@/components/ui";
import {
  CAT_COAT_COLORS,
  CAT_COAT_PATTERNS,
  CAT_COAT_WHITE_AMOUNTS,
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
  /** 最初に選んでおく毛色・柄（保存済みの値、入力エラーで戻したときは送信した値） */
  initialCoat?: Coat;
  fieldErrors?: CatFormFieldErrors;
};

/** 未設定の選択肢の値。空文字で送信し、サーバー側で未設定（NULL）として扱う */
const UNSET = "";

/**
 * 毛色・柄の入力欄。ベース色・柄・白い毛の割合をそれぞれプリセットから選び、
 * 選んだ組み合わせを見本で表示する。ベース色は見た目設定のアクセントカラーと同じく色見本だけで選び、
 * 柄・白い毛の割合の選択肢の見本は、ほかの項目で選んでいるものに合わせて描く
 */
export function CoatField({ initialCoat, fieldErrors }: CoatFieldProps) {
  const [coatColor, setCoatColor] = useState<string>(
    initialCoat?.coatColor ?? UNSET,
  );
  const [coatPattern, setCoatPattern] = useState<string>(
    initialCoat?.coatPattern ?? UNSET,
  );
  const [coatWhite, setCoatWhite] = useState<string>(
    initialCoat?.coatWhite ?? UNSET,
  );

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

      <CoatColorRadioGroup
        value={coatColor}
        onChange={setCoatColor}
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

type CoatColorRadioGroupProps = {
  value: string;
  onChange: (value: string) => void;
  errorMessage?: string;
};

/**
 * ベース色の選択肢。色の名前は文字で出さず、色見本の title と aria-label で伝える
 * （見た目設定のアクセントカラーと同じ形）
 */
function CoatColorRadioGroup({
  value,
  onChange,
  errorMessage,
}: CoatColorRadioGroupProps) {
  return (
    <div className={styles.group}>
      <AriaRadioGroup
        name="coatColor"
        orientation="horizontal"
        value={value}
        onChange={onChange}
        isInvalid={errorMessage !== undefined}
        className={styles.group}
      >
        <Label className={styles.groupLabel}>ベース色</Label>
        <div className={styles.colorOptions}>
          <AriaRadio
            value={UNSET}
            aria-label="未設定"
            className={styles.colorOption}
          >
            <span title="未設定" className={styles.colorSwatch}>
              <CoatSwatch
                coat={{ coatColor: null, coatPattern: null, coatWhite: null }}
                size="md"
              />
            </span>
          </AriaRadio>
          {CAT_COAT_COLORS.map((color) => (
            <AriaRadio
              key={color}
              value={color}
              aria-label={COAT_COLOR_LABEL[color]}
              className={styles.colorOption}
            >
              <span
                title={COAT_COLOR_LABEL[color]}
                className={styles.colorSwatch}
              >
                <CoatSwatch
                  coat={{
                    coatColor: color,
                    coatPattern: null,
                    coatWhite: null,
                  }}
                  size="md"
                />
              </span>
            </AriaRadio>
          ))}
        </div>
      </AriaRadioGroup>
      {errorMessage ? (
        <p className={styles.errorMessage}>{errorMessage}</p>
      ) : null}
    </div>
  );
}

type CoatRadioGroupProps<T extends string> = {
  name: Exclude<keyof Coat, "coatColor">;
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
        <AriaRadio value={UNSET} className={styles.option}>
          <CoatSwatch
            coat={{ coatColor: null, coatPattern: null, coatWhite: null }}
            size="md"
          />
          <span className={styles.optionLabel}>未設定</span>
          <TbCheck className={styles.check} aria-hidden="true" size={16} />
        </AriaRadio>
        {options.map((option) => {
          const [title, description] = labels[option].split(/[（）]/);
          return (
            <AriaRadio
              key={option}
              value={option}
              aria-label={labels[option]}
              className={styles.option}
            >
              <CoatSwatch coat={swatch(option)} size="md" />
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{title}</span>
                {description ? (
                  <span className={styles.optionDescription}>
                    {description}
                  </span>
                ) : null}
              </span>
              <TbCheck className={styles.check} aria-hidden="true" size={16} />
            </AriaRadio>
          );
        })}
      </RadioGroup>
      {errorMessage ? (
        <p className={styles.errorMessage}>{errorMessage}</p>
      ) : null}
    </div>
  );
}
