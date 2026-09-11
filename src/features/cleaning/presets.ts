/**
 * 初回利用時にワンタップで追加できる掃除対象のプリセット。
 * 頻度は追加後に編集できる目安の初期値
 */
export const CLEANING_TARGET_PRESETS = [
  { name: "猫砂", frequencyValue: 7, frequencyUnit: "days" },
  { name: "おしっこシート", frequencyValue: 1, frequencyUnit: "days" },
] as const;
