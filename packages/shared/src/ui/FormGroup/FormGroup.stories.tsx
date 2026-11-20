import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "../Checkbox/Checkbox";
import { FormGroup } from "./FormGroup";

const meta = {
  title: "フォーム/FormGroup",
  component: FormGroup,
  args: {
    legend: "通知を受け取る記録",
    children: (
      <>
        <Checkbox defaultSelected>ごはん</Checkbox>
        <Checkbox>お水</Checkbox>
        <Checkbox>トイレ掃除</Checkbox>
      </>
    ),
  },
  argTypes: {
    legend: { control: "text" },
  },
} satisfies Meta<typeof FormGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { description: "選んだ記録の予定の時刻に通知します。" },
};

export const WithError: Story = {
  args: { errorMessage: "1 つ以上選んでください" },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};
