import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../Button/Button";
import { BurstConfetti } from "./BurstConfetti";

const meta = {
  title: "表示/BurstConfetti",
  component: BurstConfetti,
} satisfies Meta<typeof BurstConfetti>;

export default meta;
type Story = StoryObj<typeof meta>;

function ReplayableConfetti() {
  const [count, setCount] = useState(0);
  return (
    <>
      <Button onPress={() => setCount((value) => value + 1)}>
        もう一度表示する
      </Button>
      <BurstConfetti key={count} />
    </>
  );
}

/** 表示したときに一度だけ弾ける。ボタンで描き直せる（端末で動きを減らす設定のときは表示しない） */
export const Default: Story = {
  render: () => <ReplayableConfetti />,
};
