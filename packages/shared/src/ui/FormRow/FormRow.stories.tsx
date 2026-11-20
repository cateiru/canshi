import type { Meta, StoryObj } from "@storybook/react-vite";
import { FormField } from "../FormField/FormField";
import { FormRow } from "./FormRow";

const meta = {
  title: "フォーム/FormRow",
  component: FormRow,
  args: {
    children: (
      <>
        <FormField label="日付" type="date" defaultValue="2026-11-20" />
        <FormField label="時刻" type="time" defaultValue="08:30" />
      </>
    ),
  },
} satisfies Meta<typeof FormRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
