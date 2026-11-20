import type { Meta, StoryObj } from "@storybook/react-vite";
import { CatEarFrame } from "./CatEarFrame";

const meta = {
  title: "レイアウト/CatEarFrame",
  component: CatEarFrame,
  args: {
    children: (
      <p style={{ padding: 16 }}>
        Card・Modal の土台になる、左上に猫耳の付いた枠
      </p>
    ),
  },
} satisfies Meta<typeof CatEarFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
