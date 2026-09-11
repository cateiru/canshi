/**
 * 初回利用時にワンタップで追加できる掃除対象のプリセット。
 * 頻度は追加後に編集できる目安の初期値
 */
export const CLEANING_TARGET_PRESETS = [
  { name: "猫砂", frequencyDays: 7 },
  { name: "おしっこシート", frequencyDays: 1 },
] as const;
