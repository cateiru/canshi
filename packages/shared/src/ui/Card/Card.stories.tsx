import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card";

const meta = {
  title: "レイアウト/Card",
  component: Card,
  args: {
    title: "今日の記録",
    children: <p>ごはんを 2 回、お水を 1 回記録しました。</p>,
  },
  argTypes: {
    title: { control: "text" },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutTitle: Story = {
  args: { title: undefined },
};
