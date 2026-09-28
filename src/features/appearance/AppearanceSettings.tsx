"use client";

import { useId, useState } from "react";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Surface } from "@/features/shared/Surface";
import styles from "./AppearanceSettings.module.css";
import { saveContrastAction, saveThemeAction } from "./actions";
import {
  type Appearance,
  CONTRAST_LABEL,
  CONTRASTS,
  type Contrast,
  THEME_LABEL,
  THEMES,
  type Theme,
} from "./preferences";

const THEME_DESCRIPTION: Record<Theme, string> = {
  light: "明るい背景で表示します。",
  dark: "暗い背景で表示します。",
  system: "この端末の設定に合わせて、ライトとダークを自動で切り替えます。",
};

const CONTRAST_DESCRIPTION: Record<Contrast, string> = {
  default: "標準の見た目で表示します。",
  more: "枠線や補助の文字を濃くして、入力欄やボタンの境目を見やすくします。",
};

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  descriptions: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
};

function SegmentedControl<T extends string>({
  label,
  options,
  labels,
  descriptions,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const descriptionId = useId();

  return (
    <div className={styles.control}>
      <ToggleButtonGroup
        className={styles.group}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const [next] = keys;
          if (next) {
            onChange(next as T);
          }
        }}
        aria-label={label}
        aria-describedby={descriptionId}
      >
        {options.map((option) => (
          <ToggleButton key={option} id={option} className={styles.button}>
            {labels[option]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <p id={descriptionId} className={styles.description}>
        {descriptions[value]}
      </p>
    </div>
  );
}

/**
 * テーマ・コントラストの切り替え。表示中のページには <html> の data 属性を直接書き換えて
 * すぐに反映し、選んだ値は Server Action で cookie に保存する（以降のサーバー描画で
 * RootLayout が <html> に出力する）。
 */
export function AppearanceSettings({
  initialAppearance,
}: {
  initialAppearance: Appearance;
}) {
  const [theme, setTheme] = useState(initialAppearance.theme);
  const [contrast, setContrast] = useState(initialAppearance.contrast);

  return (
    <>
      <Surface title="テーマ">
        <SegmentedControl
          label="テーマ"
          options={THEMES}
          labels={THEME_LABEL}
          descriptions={THEME_DESCRIPTION}
          value={theme}
          onChange={(next) => {
            document.documentElement.dataset.theme = next;
            setTheme(next);
            void saveThemeAction(next);
          }}
        />
      </Surface>

      <Surface title="コントラスト">
        <SegmentedControl
          label="コントラスト"
          options={CONTRASTS}
          labels={CONTRAST_LABEL}
          descriptions={CONTRAST_DESCRIPTION}
          value={contrast}
          onChange={(next) => {
            document.documentElement.dataset.contrast = next;
            setContrast(next);
            void saveContrastAction(next);
          }}
        />
      </Surface>
    </>
  );
}
