import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FormField } from "./FormField";

const meta = {
  title: "フォーム/FormField",
  component: FormField,
  args: {
    label: "名前",
    placeholder: "たま",
    onChange: fn(),
  },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: "あとから変更できます。" },
};

export const LabelHidden: Story = {
  args: { isLabelHidden: true, defaultValue: "たま" },
};

export const WithError: Story = {
  args: { errorMessage: "名前を入力してください" },
};

export const Disabled: Story = {
  args: { isDisabled: true, defaultValue: "たま" },
};
