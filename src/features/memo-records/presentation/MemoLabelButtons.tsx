"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TbPencil, TbPlus, TbTrash } from "react-icons/tb";
import { addToast, Button, IconButton, Modal } from "@/components/ui";
import type { MemoLabelFormInput } from "../domain/labelSchema";
import { memoLabelInUseMessage } from "../domain/labels";
import type { MemoLabelView } from "../domain/memoLabel";
import type {
  DeleteMemoLabelActionResult,
  SaveMemoLabelActionResult,
} from "./labelActions";
import styles from "./MemoLabelButtons.module.css";
import { MemoLabelFormModal } from "./MemoLabelFormModal";

type SaveAction = (
  input: MemoLabelFormInput,
) => Promise<SaveMemoLabelActionResult>;

/** ラベルを追加するボタン。モーダルで名前と色を入力する */
export function AddMemoLabelButton({ action }: { action: SaveAction }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="primary"
        leftIcon={TbPlus}
        aria-haspopup="dialog"
        onPress={() => setOpen(true)}
      >
        ラベルを追加する
      </Button>
      <MemoLabelFormModal
        open={open}
        action={action}
        onSaved={(label) => {
          setOpen(false);
          addToast({
            title: `「${label.name}」を追加しました`,
            color: "success",
          });
          router.refresh();
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** ラベルの名前と色を編集するボタン */
export function EditMemoLabelButton({
  label,
  action,
}: {
  label: MemoLabelView;
  action: SaveAction;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <IconButton
        icon={TbPencil}
        aria-label={`「${label.name}」を編集する`}
        title="編集する"
        aria-haspopup="dialog"
        onPress={() => setOpen(true)}
      />
      <MemoLabelFormModal
        open={open}
        label={label}
        action={action}
        onSaved={(saved) => {
          setOpen(false);
          addToast({
            title: `「${saved.name}」を更新しました`,
            color: "success",
          });
          router.refresh();
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** ラベルを削除するボタン。メモに付いているラベルは、確認ダイアログで削除できない理由だけを表示する */
export function DeleteMemoLabelButton({
  label,
  memoCount,
  action,
}: {
  label: MemoLabelView;
  /** ラベルが付いているメモの数 */
  memoCount: number;
  action: () => Promise<DeleteMemoLabelActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await action();
      setOpen(false);
      if (result.error) {
        addToast({ title: result.error, color: "error" });
      } else {
        addToast({
          title: `「${label.name}」を削除しました`,
          color: "success",
        });
      }
      // 一覧を開いた後にメモに付けられて断られたときも、付いているメモの数を取り直す
      router.refresh();
    });
  };

  return (
    <>
      <IconButton
        icon={TbTrash}
        aria-label={`「${label.name}」を削除する`}
        title="削除する"
        aria-haspopup="dialog"
        onPress={() => setOpen(true)}
      />
      <Modal open={open} title="ラベルの削除" onClose={() => setOpen(false)}>
        {memoCount > 0 ? (
          <p>{memoLabelInUseMessage(memoCount)}。</p>
        ) : (
          <>
            <p>「{label.name}」を削除しますか？この操作は取り消せません。</p>
            <div className={styles.actions}>
              <Button
                variant="danger"
                isDisabled={isPending}
                onPress={handleDelete}
              >
                {isPending ? "削除中..." : "削除する"}
              </Button>
              <Button variant="secondary" onPress={() => setOpen(false)}>
                キャンセル
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
