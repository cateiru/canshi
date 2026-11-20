import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/styles/tokens.css";
import "./preview.css";

/**
 * 見た目設定（テーマ・アクセントカラー・コントラスト・文字サイズ）を、メインアプリと同じく
 * <html> の data 属性で切り替える（src/styles/tokens.css の先頭のコメント参照）
 */
const withAppearance: Decorator = (Story, context) => {
  const root = document.documentElement;
  root.dataset.theme = context.globals.theme;
  root.dataset.accent = context.globals.accent;
  root.dataset.contrast = context.globals.contrast;
  root.dataset.fontSize = context.globals.fontSize;
  return <Story />;
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "テーマ",
      toolbar: {
        title: "テーマ",
        icon: "mirror",
        items: [
          { value: "light", title: "ライト" },
          { value: "dark", title: "ダーク" },
          { value: "system", title: "端末の設定に合わせる" },
        ],
        dynamicTitle: true,
      },
    },
    accent: {
      description: "アクセントカラー",
      toolbar: {
        title: "アクセントカラー",
        icon: "paintbrush",
        items: [
          { value: "orange", title: "オレンジ" },
          { value: "blue", title: "ブルー" },
          { value: "green", title: "グリーン" },
          { value: "pink", title: "ピンク" },
          { value: "purple", title: "パープル" },
        ],
        dynamicTitle: true,
      },
    },
    contrast: {
      description: "コントラスト",
      toolbar: {
        title: "コントラスト",
        icon: "contrast",
        items: [
          { value: "default", title: "標準" },
          { value: "more", title: "高い" },
        ],
        dynamicTitle: true,
      },
    },
    fontSize: {
      description: "文字サイズ",
      toolbar: {
        title: "文字サイズ",
        icon: "paragraph",
        items: [
          { value: "small", title: "小" },
          { value: "medium", title: "中" },
          { value: "large", title: "大" },
          { value: "xlarge", title: "特大" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
    accent: "orange",
    contrast: "default",
    fontSize: "medium",
  },
  decorators: [withAppearance],
  parameters: {
    layout: "padded",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
