import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbBell, TbSettings } from "react-icons/tb";
import { Badge } from "../Badge/Badge";
import { IconButtonLink } from "./IconButtonLink";

const meta = {
  title: "操作/IconButtonLink",
  component: IconButtonLink,
  args: {
    href: "#settings",
    icon: TbSettings,
    "aria-label": "設定",
  },
  argTypes: {
    icon: { control: false },
    linkComponent: { control: false },
  },
} satisfies Meta<typeof IconButtonLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** children はアイコンの後ろに描く（未読件数のバッジなど） */
export const WithChildren: Story = {
  args: {
    href: "#notifications",
    icon: TbBell,
    "aria-label": "通知",
    children: <Badge color="error">3</Badge>,
  },
};
