import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ComboBox } from "./ComboBox";

const meta = {
  title: "フォーム/ComboBox",
  component: ComboBox,
  args: {
    label: "猫種",
    placeholder: "入力して探す",
    options: [
      { value: "mix", label: "ミックス" },
      { value: "munchkin", label: "マンチカン" },
      { value: "scottish-fold", label: "スコティッシュフォールド" },
      { value: "american-shorthair", label: "アメリカンショートヘア" },
      { value: "ragdoll", label: "ラグドール" },
    ],
    onSelectionChange: fn(),
  },
} satisfies Meta<typeof ComboBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: "候補にないときは「ミックス」を選んでください。" },
};

export const WithError: Story = {
  args: { errorMessage: "猫種を選んでください" },
};
