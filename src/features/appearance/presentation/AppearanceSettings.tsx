"use client";

import { useId, useState } from "react";
import { Radio, RadioGroup } from "react-aria-components";
import { SegmentedControl } from "@/components/ui";
import { Surface } from "@/features/shared/Surface";
import {
  ACCENT_LABEL,
  ACCENTS,
  type Accent,
  type Appearance,
  CONTRAST_LABEL,
  CONTRASTS,
  type Contrast,
  FONT_SIZE_LABEL,
  FONT_SIZES,
  type FontSize,
  THEME_LABEL,
  THEMES,
  type Theme,
} from "../domain/preferences";
import styles from "./AppearanceSettings.module.css";
import {
  saveAccentAction,
  saveContrastAction,
  saveFontSizeAction,
  saveThemeAction,
} from "./actions";

const THEME_DESCRIPTION: Record<Theme, string> = {
  light: "明るい背景で表示します。",
  dark: "暗い背景で表示します。",
  system: "この端末の設定に合わせて、ライトとダークを自動で切り替えます。",
};

const CONTRAST_DESCRIPTION: Record<Contrast, string> = {
  default: "標準の見た目で表示します。",
  more: "枠線や補助の文字を濃くして、入力欄やボタンの境目を見やすくします。",
};

const FONT_SIZE_DESCRIPTION: Record<FontSize, string> = {
  small: "文字を小さくして、一度に多くの情報を表示します。",
  medium: "標準の大きさで表示します。",
  large: "文字を大きくして読みやすくします。",
  xlarge: "文字をさらに大きくして、はっきり読めるようにします。",
};

/**
 * 選択肢に表示する色見本。tokens.css の data-accent のブロックと同じ色にする
 * （選んでいない色も見本として見せるため、トークンではなく値を直接持つ）
 */
const ACCENT_SWATCH: Record<Accent, string> = {
  orange: "#ec995a",
  blue: "#6fb3e0",
  green: "#7cc48a",
  pink: "#ef9ab8",
  purple: "#b39ddb",
};

/** 色見本つきのアクセントカラーの選択肢 */
function AccentOption({
  value,
  onChange,
}: {
  value: Accent;
  onChange: (value: Accent) => void;
}) {
  const descriptionId = useId();

  return (
    <div className={styles.control}>
      <RadioGroup
        className={styles.accentGroup}
        orientation="horizontal"
        aria-label="アクセントカラー"
        aria-describedby={descriptionId}
        value={value}
        onChange={(next) => onChange(next as Accent)}
      >
        {ACCENTS.map((accent) => (
          <Radio key={accent} value={accent} className={styles.accentOption}>
            <span
              className={styles.swatch}
              style={{ backgroundColor: ACCENT_SWATCH[accent] }}
              aria-hidden="true"
            />
            {ACCENT_LABEL[accent]}
          </Radio>
        ))}
      </RadioGroup>
      <p id={descriptionId} className={styles.description}>
        ボタンや選択中の項目などに使う色を変えます。
      </p>
    </div>
  );
}

type AppearanceOptionProps<T extends string> = {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  descriptions: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
};

/** 切り替えボタンと、選んでいる選択肢の説明 */
function AppearanceOption<T extends string>({
  label,
  descriptions,
  value,
  ...props
}: AppearanceOptionProps<T>) {
  const descriptionId = useId();

  return (
    <div className={styles.control}>
      <SegmentedControl
        value={value}
        aria-label={label}
        aria-describedby={descriptionId}
        {...props}
      />
      <p id={descriptionId} className={styles.description}>
        {descriptions[value]}
      </p>
    </div>
  );
}

/**
 * テーマ・アクセントカラー・コントラスト・文字サイズの切り替え。表示中のページには <html> の data 属性を直接書き換えて
 * すぐに反映し、選んだ値は Server Action で cookie に保存する（以降のサーバー描画で
 * RootLayout が <html> に出力する）。
 */
export function AppearanceSettings({
  initialAppearance,
}: {
  initialAppearance: Appearance;
}) {
  const [theme, setTheme] = useState(initialAppearance.theme);
  const [accent, setAccent] = useState(initialAppearance.accent);
  const [contrast, setContrast] = useState(initialAppearance.contrast);
  const [fontSize, setFontSize] = useState(initialAppearance.fontSize);

  return (
    <>
      <Surface title="テーマ">
        <AppearanceOption
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

      <Surface title="アクセントカラー">
        <AccentOption
          value={accent}
          onChange={(next) => {
            document.documentElement.dataset.accent = next;
            setAccent(next);
            void saveAccentAction(next);
          }}
        />
      </Surface>

      <Surface title="コントラスト">
        <AppearanceOption
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

      <Surface title="文字サイズ">
        <AppearanceOption
          label="文字サイズ"
          options={FONT_SIZES}
          labels={FONT_SIZE_LABEL}
          descriptions={FONT_SIZE_DESCRIPTION}
          value={fontSize}
          onChange={(next) => {
            document.documentElement.dataset.fontSize = next;
            setFontSize(next);
            void saveFontSizeAction(next);
          }}
        />
      </Surface>
    </>
  );
}
