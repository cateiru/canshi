import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert } from "./Alert";

const meta = {
  title: "表示/Alert",
  component: Alert,
  args: {
    children: "記録を保存しました。",
  },
  argTypes: {
    color: {
      control: "inline-radio",
      options: ["info", "success", "warning", "error"],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: { color: "info", children: "お知らせがあります。" },
};

export const Success: Story = {
  args: { color: "success", children: "記録を保存しました。" },
};

export const Warning: Story = {
  args: { color: "warning", children: "体重が前回から大きく変わっています。" },
};

export const ErrorColor: Story = {
  name: "Error",
  args: { color: "error", children: "保存できませんでした。" },
};
