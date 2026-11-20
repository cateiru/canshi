import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbChevronRight, TbPlus } from "react-icons/tb";
import { fn } from "storybook/test";
import { Button } from "./Button";

const meta = {
  title: "操作/Button",
  component: Button,
  args: {
    children: "保存する",
    variant: "secondary",
    onPress: fn(),
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "danger", "ghost"],
    },
    leftIcon: { control: false },
    rightIcon: { control: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Secondary: Story = {};

export const Danger: Story = {
  args: { variant: "danger", children: "削除する" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "次の月", rightIcon: TbChevronRight },
};

export const WithIcon: Story = {
  args: { variant: "primary", children: "記録する", leftIcon: TbPlus },
};

export const Disabled: Story = {
  args: { variant: "primary", isDisabled: true },
};
