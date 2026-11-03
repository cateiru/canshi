"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import type { SubmitRedirect } from "@/features/navigation/types";
import { useNavigateAfterSubmit } from "@/features/navigation/useNavigateAfterSubmit";

type CleaningTargetPresetButtonProps = {
  action: () => Promise<SubmitRedirect>;
  label: string;
};

/** プリセットの掃除対象をワンタップで追加し、追加後は掃除記録の一覧へ遷移するボタン */
export function CleaningTargetPresetButton({
  action,
  label,
}: CleaningTargetPresetButtonProps) {
  const [isPending, startTransition] = useTransition();
  // 追加後の画面遷移が終わるまでは送信中として扱い、二重送信を防ぐ
  const [isNavigating, setIsNavigating] = useState(false);
  const navigateAfterSubmit = useNavigateAfterSubmit();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await action();
          if (result.redirectTo) {
            setIsNavigating(true);
            navigateAfterSubmit(result.redirectTo);
          }
        });
      }}
    >
      <Button
        type="submit"
        variant="secondary"
        isDisabled={isPending || isNavigating}
      >
        {label}
      </Button>
    </form>
  );
}
