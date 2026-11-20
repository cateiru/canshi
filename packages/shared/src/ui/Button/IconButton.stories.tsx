import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbPencil, TbTrash } from "react-icons/tb";
import { fn } from "storybook/test";
import { IconButton } from "./IconButton";

const meta = {
  title: "操作/IconButton",
  component: IconButton,
  args: {
    icon: TbPencil,
    "aria-label": "編集する",
    onPress: fn(),
  },
  argTypes: {
    icon: { control: false },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithTitle: Story = {
  args: { icon: TbTrash, "aria-label": "削除する", title: "削除する" },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};
