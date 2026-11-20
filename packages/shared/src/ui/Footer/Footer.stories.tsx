import type { Meta, StoryObj } from "@storybook/react-vite";
import { Footer } from "./Footer";

const meta = {
  title: "ナビゲーション/Footer",
  component: Footer,
  args: {
    version: "1.0.0",
    versionHref: "#release-notes",
  },
  argTypes: {
    linkComponent: { control: false },
  },
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
