import type { Meta, StoryObj } from "@storybook/react-vite";
import { TbPlus } from "react-icons/tb";
import { ButtonLink } from "../Button/ButtonLink";
import { WeightIcon } from "../RecordIcons/RecordIcons";
import { RecordCard, RecordEmptyState } from "./RecordCard";

const meta = {
  title: "レイアウト/RecordCard",
  component: RecordCard,
  args: {
    children: (
      <>
        <p>2026年11月20日 8:30</p>
        <p>4.2 kg</p>
      </>
    ),
  },
  argTypes: {
    as: { control: "inline-radio", options: ["article", "section", "div"] },
  },
} satisfies Meta<typeof RecordCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 記録がまだないときに、一覧の代わりに表示するカード */
export const EmptyState: Story = {
  render: () => (
    <RecordEmptyState
      icon={WeightIcon}
      actions={
        <ButtonLink href="#new" variant="primary" leftIcon={TbPlus}>
          最初の記録をする
        </ButtonLink>
      }
    >
      体重の記録はまだありません。
    </RecordEmptyState>
  ),
};
