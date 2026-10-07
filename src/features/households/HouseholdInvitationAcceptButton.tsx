"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { addToast, Button } from "@/components/ui";
import type { HouseholdMemberActionResult } from "./actions";

type HouseholdInvitationAcceptButtonProps = {
  householdName: string;
  action: () => Promise<HouseholdMemberActionResult>;
};

/**
 * 招待された家に参加するボタン。参加したら招待のページを履歴に残さず猫一覧へ移る
 * （戻るで使用済みの招待のページを開き直さないように）
 */
export function HouseholdInvitationAcceptButton({
  householdName,
  action,
}: HouseholdInvitationAcceptButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAccept = () => {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        addToast({ title: result.error, color: "error" });
        router.refresh();
        return;
      }
      addToast({
        title: `「${householdName}」に参加しました`,
        color: "success",
      });
      router.replace(result.redirectTo ?? "/cats");
    });
  };

  return (
    <Button variant="primary" isDisabled={isPending} onPress={handleAccept}>
      {isPending ? "参加しています..." : "参加する"}
    </Button>
  );
}
