"use client";

import { useId, useState } from "react";
import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  Label,
} from "react-aria-components";
import { CAT_COAT_COLORS, type CatCoatColor } from "@/db/schema";
import { type Coat, formatCoat } from "../domain/coat";
import { COAT_COLOR_LABEL } from "../domain/labels";
import type { CatFormFieldErrors } from "../domain/schema";
import { CatCoatPatternDefs, catCoatIconStyle } from "./CatCoatPatternDefs";
import { CatIcon } from "./CatIcon";
import styles from "./CoatField.module.css";
import { CoatSwatch } from "./CoatSwatch";

type CoatFieldProps = {
  /** 最初に選んでおく毛色（保存済みの値、入力エラーで戻したときは送信した値） */
  initialCoat?: Coat;
  fieldErrors?: CatFormFieldErrors;
};

/** 未設定の選択肢の値。空文字で送信し、サーバー側で未設定（NULL）として扱う */
const UNSET = "";

/**
 * 毛色の入力欄。ベース色をプリセットから色見本だけで選び（見た目設定のアクセントカラーと同じ形）、
 * 選んだ毛色で塗った猫のアイコンをプレビューに出す
 */
export function CoatField({ initialCoat, fieldErrors }: CoatFieldProps) {
  const [coatColor, setCoatColor] = useState<string>(
    initialCoat?.coatColor ?? UNSET,
  );
  const coat: Coat = {
    coatColor: (coatColor || null) as CatCoatColor | null,
  };

  return (
    <>
      <div className={styles.preview}>
        <CoatPreview coatColor={coat.coatColor} />
        <p className={styles.previewLabel}>{formatCoat(coat) ?? "未設定"}</p>
      </div>

      <CoatColorRadioGroup
        value={coatColor}
        onChange={setCoatColor}
        errorMessage={fieldErrors?.coatColor?.[0]}
      />
    </>
  );
}

/**
 * 選んでいる毛色で塗った猫のアイコン。猫のページでは保存済みの毛色がレイアウトで設定されているため、
 * それを受け継がないようにする
 */
function CoatPreview({ coatColor }: { coatColor: CatCoatColor | null }) {
  // useId の値は記号を含み、CSS の url() にそのまま書けないため取り除く
  const patternId = `coat-preview-${useId().replace(/[^\w-]/g, "")}`;

  return (
    <span
      className={styles.previewIcon}
      style={catCoatIconStyle(coatColor, patternId, { isolate: true })}
    >
      <CatCoatPatternDefs coatColor={coatColor} patternId={patternId} />
      <CatIcon aria-hidden="true" size="100%" />
    </span>
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
              <CoatSwatch coat={{ coatColor: null }} size="md" />
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
                <CoatSwatch coat={{ coatColor: color }} size="md" />
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
