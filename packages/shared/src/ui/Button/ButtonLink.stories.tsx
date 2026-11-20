import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbPlus } from "react-icons/tb";
import { ButtonLink } from "./ButtonLink";

const meta = {
  title: "操作/ButtonLink",
  component: ButtonLink,
  args: {
    href: "#new",
    children: "記録する",
    variant: "secondary",
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["primary", "secondary", "danger", "ghost"],
    },
    leftIcon: { control: false },
    rightIcon: { control: false },
    linkComponent: { control: false },
  },
} satisfies Meta<typeof ButtonLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PrimaryWithIcon: Story = {
  args: { variant: "primary", leftIcon: TbPlus },
};
