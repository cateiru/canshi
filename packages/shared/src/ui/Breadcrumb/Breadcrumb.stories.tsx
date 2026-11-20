import type { Meta, StoryObj } from "@storybook/react-vite";
import { Breadcrumb } from "./Breadcrumb";

const meta = {
  title: "ナビゲーション/Breadcrumb",
  component: Breadcrumb,
  args: {
    items: [
      { label: "ねこ", href: "#cats" },
      { label: "たま", href: "#tama" },
      { label: "体重の記録" },
    ],
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleItem: Story = {
  args: {
    items: [{ label: "ねこ" }],
  },
};
