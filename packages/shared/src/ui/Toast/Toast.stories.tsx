import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { addToast, type ToastColor, ToastRegionRoot } from "./Toast";

const colors: { color: ToastColor; title: string }[] = [
  { color: "info", title: "お知らせがあります" },
  { color: "success", title: "記録を保存しました" },
  { color: "warning", title: "通信が不安定です" },
  { color: "error", title: "保存できませんでした" },
];

function ToastDemo() {
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {colors.map(({ color, title }) => (
          <Button key={color} onPress={() => addToast({ title, color })}>
            {color}
          </Button>
        ))}
      </div>
      <ToastRegionRoot />
    </>
  );
}

const meta = {
  title: "表示/Toast",
  component: ToastDemo,
} satisfies Meta<typeof ToastDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ボタンを押すと、その色のトーストを 5 秒間表示する */
export const Default: Story = {};
