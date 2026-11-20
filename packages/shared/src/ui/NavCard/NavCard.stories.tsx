import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AppearanceSettingsIcon,
  FeedingIcon,
  WeightIcon,
} from "../RecordIcons/RecordIcons";
import { NavCard } from "./NavCard";

const meta = {
  title: "ナビゲーション/NavCard",
  component: NavCard,
  args: {
    href: "#appearance",
    icon: AppearanceSettingsIcon,
    title: "見た目",
    description: "テーマ・アクセントカラー・文字サイズを変えます",
    layout: "row",
  },
  argTypes: {
    layout: { control: "inline-radio", options: ["row", "tile"] },
    titleAs: { control: "inline-radio", options: ["h2", "h3", "span"] },
    title: { control: "text" },
    description: { control: "text" },
    icon: { control: false },
    avatar: { control: false },
    linkComponent: { control: false },
  },
} satisfies Meta<typeof NavCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Row: Story = {};

export const Tiles: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 120px))",
        gap: 8,
      }}
    >
      <NavCard
        layout="tile"
        href="#feeding"
        icon={FeedingIcon}
        title="ごはん"
      />
      <NavCard layout="tile" href="#weight" icon={WeightIcon} title="体重" />
    </div>
  ),
};
