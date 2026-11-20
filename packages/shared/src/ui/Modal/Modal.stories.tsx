import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fn } from "storybook/test";
import { Button } from "../Button/Button";
import { Modal, type ModalProps } from "./Modal";

const meta = {
  title: "レイアウト/Modal",
  component: Modal,
  args: {
    open: false,
    title: "記録を削除しますか？",
    onClose: fn(),
    children: <p>削除した記録は元に戻せません。</p>,
  },
  argTypes: {
    size: { control: "inline-radio", options: ["md", "lg"] },
    title: { control: "text" },
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

function ModalWithTrigger(args: ModalProps) {
  const [open, setOpen] = useState(args.open);
  const close = () => {
    setOpen(false);
    args.onClose();
  };
  return (
    <>
      <Button onPress={() => setOpen(true)}>開く</Button>
      <Modal {...args} open={open} onClose={close}>
        {args.children}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Button onPress={close}>キャンセル</Button>
          <Button variant="danger" onPress={close}>
            削除する
          </Button>
        </div>
      </Modal>
    </>
  );
}

export const Default: Story = {
  render: (args) => <ModalWithTrigger {...args} />,
};

export const Opened: Story = {
  args: { open: true },
  render: (args) => <ModalWithTrigger {...args} />,
};

/** 外側を押す・Escape キーでは閉じず、中のボタンで選ぶまで閉じない */
export const NotDismissable: Story = {
  args: { open: true, isDismissable: false },
  render: (args) => <ModalWithTrigger {...args} />,
};

export const Large: Story = {
  args: {
    open: true,
    size: "lg",
    title: "画像",
    children: <p>画像・動画の表示など、幅を広く使うときの大きさ</p>,
  },
  render: (args) => <ModalWithTrigger {...args} />,
};
