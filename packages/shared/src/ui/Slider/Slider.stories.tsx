import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Slider } from "./Slider";

const meta = {
  title: "フォーム/Slider",
  component: Slider,
  args: {
    label: "食べた割合",
    defaultValue: 80,
    minValue: 0,
    maxValue: 100,
    step: 10,
    formatValue: (value: number) => `${value}%`,
    onChange: fn(),
  },
  argTypes: {
    formatValue: { control: false },
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { isDisabled: true },
};
