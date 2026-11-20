import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbCat, TbHome, TbPlus } from "react-icons/tb";
import { fn } from "storybook/test";
import { DropdownMenu } from "./DropdownMenu";

const meta = {
  title: "操作/DropdownMenu",
  component: DropdownMenu,
  args: {
    label: "追加する",
    leftIcon: TbPlus,
    items: [
      { id: "cat", label: "ねこを登録する", icon: TbCat },
      { id: "household", label: "家を作る", icon: TbHome },
    ],
    onAction: fn(),
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "danger", "ghost"],
    },
    leftIcon: { control: false },
    navigate: { control: false },
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: { variant: "primary" },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};
