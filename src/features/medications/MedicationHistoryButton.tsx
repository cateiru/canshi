"use client";

import { useTransition } from "react";
import { TbArchive, TbArrowBackUp } from "react-icons/tb";
import { Button } from "@/components/ui";

// アイコン（関数）は Server Component から渡せないため、種類からこちらで選ぶ
const BUTTON_CONTENT = {
  archive: { label: "服薬歴に移す", icon: TbArchive },
  unarchive: { label: "服薬予定に戻す", icon: TbArrowBackUp },
} as const;

type MedicationHistoryButtonProps = {
  /** 服薬歴へ移す・服薬予定に戻す Server Action。Action 内で一覧ページへ `redirect` する */
  action: () => Promise<void>;
  kind: keyof typeof BUTTON_CONTENT;
};

/** 服薬予定を服薬歴に移す、または服薬予定に戻すボタン */
export function MedicationHistoryButton({
  action,
  kind,
}: MedicationHistoryButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { label, icon } = BUTTON_CONTENT[kind];

  return (
    <Button
      variant="secondary"
      leftIcon={icon}
      isDisabled={isPending}
      onPress={() => {
        startTransition(async () => {
          await action();
        });
      }}
    >
      {label}
    </Button>
  );
}
