import type { Meta, StoryObj } from "@storybook/react-vite";
import { FilterTabs } from "./FilterTabs";

const meta = {
  title: "ナビゲーション/FilterTabs",
  component: FilterTabs,
  args: {
    "aria-label": "表示するねこ",
    selectedKey: "all",
    items: [
      { key: "all", href: "#all", label: "すべて" },
      { key: "tama", href: "#tama", label: "たま" },
      { key: "mike", href: "#mike", label: "みけ" },
      { key: "kuro", href: "#kuro", label: "くろ" },
    ],
  },
  argTypes: {
    selectedKey: {
      control: "inline-radio",
      options: ["all", "tama", "mike", "kuro"],
    },
    linkComponent: { control: false },
  },
} satisfies Meta<typeof FilterTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
