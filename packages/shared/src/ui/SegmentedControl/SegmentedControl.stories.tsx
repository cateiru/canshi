import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SegmentedControl } from "./SegmentedControl";

const periods = ["week", "threeMonths", "halfYear"] as const;
type Period = (typeof periods)[number];

const labels: Record<Period, string> = {
  week: "1週間",
  threeMonths: "3ヶ月",
  halfYear: "半年",
};

type PeriodControlProps = {
  size: "sm" | "md";
};

function PeriodControl({ size }: PeriodControlProps) {
  const [value, setValue] = useState<Period>("week");
  return (
    <SegmentedControl
      options={periods}
      labels={labels}
      value={value}
      onChange={setValue}
      aria-label="表示する期間"
      size={size}
    />
  );
}

const meta = {
  title: "操作/SegmentedControl",
  component: PeriodControl,
  args: {
    size: "md",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md"] },
  },
} satisfies Meta<typeof PeriodControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};

export const Small: Story = {
  args: { size: "sm" },
};
