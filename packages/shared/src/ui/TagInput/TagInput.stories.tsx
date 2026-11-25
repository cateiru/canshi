import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { TagInput, type TagInputProps } from "./TagInput";

/** 付けたタグを状態で持ち、付け外しできるようにする */
function StatefulTagInput({ value, onChange, ...props }: TagInputProps) {
  const [tags, setTags] = useState<string[]>([...value]);
  return (
    <TagInput
      {...props}
      value={tags}
      onChange={(next) => {
        setTags(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: "フォーム/TagInput",
  component: StatefulTagInput,
  args: {
    label: "ラベル",
    value: ["お手入れ", "好きなもの"],
    suggestions: ["お手入れ", "好きなもの", "病院"],
    placeholder: "入力して Enter で追加",
    onChange: fn(),
  },
} satisfies Meta<typeof StatefulTagInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { value: [] },
};

export const ManyTags: Story = {
  args: {
    value: [
      "お手入れ",
      "好きなもの",
      "病院",
      "とても長い名前のラベルをつけたときの折り返し",
      "ごはん",
      "性格",
    ],
  },
};

export const WithError: Story = {
  args: { errorMessage: "ラベルは20個まで付けられます" },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};
