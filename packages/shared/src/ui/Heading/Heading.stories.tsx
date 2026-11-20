import type { Meta, StoryObj } from "@storybook/react-vite";
import { Heading } from "./Heading";

const meta = {
  title: "表示/Heading",
  component: Heading,
  args: {
    children: "ごはんの記録",
    level: 2,
  },
  argTypes: {
    level: { control: "inline-radio", options: [1, 2, 3, 4, 5, 6] },
    size: { control: "inline-radio", options: ["xl", "lg", "md", "sm"] },
  },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllSizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: 8 }}>
      <Heading {...args} size="xl">
        xl の見出し
      </Heading>
      <Heading {...args} size="lg">
        lg の見出し
      </Heading>
      <Heading {...args} size="md">
        md の見出し
      </Heading>
      <Heading {...args} size="sm">
        sm の見出し
      </Heading>
    </div>
  ),
};
