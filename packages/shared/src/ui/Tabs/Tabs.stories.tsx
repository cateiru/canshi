import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "./Tabs";

const meta = {
  title: "ナビゲーション/Tabs",
  component: Tabs,
  args: {
    "aria-label": "記録の種類",
    items: [
      { id: "feeding", label: "ごはん", content: <p>ごはんの記録</p> },
      { id: "water", label: "お水", content: <p>お水の記録</p> },
      { id: "poop", label: "うんち", content: <p>うんちの記録</p> },
    ],
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DefaultSelected: Story = {
  args: { defaultSelectedKey: "water" },
};
