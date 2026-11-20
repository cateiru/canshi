import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Textarea } from "./Textarea";

const meta = {
  title: "フォーム/Textarea",
  component: Textarea,
  args: {
    label: "メモ",
    rows: 4,
    placeholder: "気になったことを書きます",
    onChange: fn(),
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: "家のメンバー全員が読めます。" },
};

export const WithError: Story = {
  args: { errorMessage: "1000 文字以内で入力してください" },
};
