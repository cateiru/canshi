import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pagination } from "./Pagination";

const meta = {
  title: "ナビゲーション/Pagination",
  component: Pagination,
  args: {
    page: 2,
    totalPages: 5,
    getHref: (page: number) => `#page-${page}`,
  },
  argTypes: {
    getHref: { control: false },
    linkComponent: { control: false },
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstPage: Story = {
  args: { page: 1 },
};

export const LastPage: Story = {
  args: { page: 5 },
};
