import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Radio, RadioGroup } from "./Radio";

const meta = {
  title: "フォーム/Radio",
  component: RadioGroup,
  args: {
    label: "食べた量",
    defaultValue: "all",
    onChange: fn(),
    children: (
      <>
        <Radio value="all">完食</Radio>
        <Radio value="half">半分</Radio>
        <Radio value="none">食べなかった</Radio>
      </>
    ),
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { isDisabled: true },
};
