import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbSettings } from "react-icons/tb";
import { Badge } from "../Badge/Badge";
import { IconButtonLink } from "../Button/IconButtonLink";
import { Collapsible } from "./Collapsible";

const meta = {
  title: "レイアウト/Collapsible",
  component: Collapsible,
  args: {
    title: "体重のグラフ",
    children: <p>ここにグラフを表示します。</p>,
  },
  argTypes: {
    headingLevel: { control: "inline-radio", options: [2, 3, 4] },
  },
} satisfies Meta<typeof Collapsible>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Collapsed: Story = {
  args: { defaultExpanded: false },
};

export const WithAsideAndActions: Story = {
  args: {
    title: "VRTの家",
    titleAside: <Badge color="accent">3 匹</Badge>,
    headerActions: (
      <IconButtonLink
        href="#household-settings"
        icon={TbSettings}
        aria-label="家の設定"
      />
    ),
  },
};
