import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Select } from "./Select";

const meta = {
  title: "フォーム/Select",
  component: Select,
  args: {
    label: "ねこ",
    placeholder: "選んでください",
    options: [
      { value: "tama", label: "たま" },
      { value: "mike", label: "みけ" },
      { value: "kuro", label: "くろ" },
    ],
    onSelectionChange: fn(),
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: { defaultSelectedKey: "mike" },
};

export const WithDescription: Story = {
  args: { description: "記録するねこを選びます。" },
};

export const WithError: Story = {
  args: { errorMessage: "ねこを選んでください" },
};
