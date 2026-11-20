import type { Meta, StoryObj } from "@storybook/react-vite";
import { MonthNav } from "./MonthNav";

const meta = {
  title: "ナビゲーション/MonthNav",
  component: MonthNav,
  args: {
    year: 2026,
    month: 11,
    prevHref: "#2026-10",
    nextHref: "#2026-12",
  },
  argTypes: {
    month: { control: { type: "number", min: 1, max: 12 } },
    linkComponent: { control: false },
  },
} satisfies Meta<typeof MonthNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
