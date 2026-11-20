import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./Badge";

const meta = {
  title: "表示/Badge",
  component: Badge,
  args: {
    children: "オーナー",
    color: "info",
  },
  argTypes: {
    color: {
      control: "inline-radio",
      options: ["info", "success", "warning", "error", "accent"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllColors: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Badge {...args} color="info">
        info
      </Badge>
      <Badge {...args} color="success">
        success
      </Badge>
      <Badge {...args} color="warning">
        warning
      </Badge>
      <Badge {...args} color="error">
        error
      </Badge>
      <Badge {...args} color="accent">
        accent
      </Badge>
    </div>
  ),
};
