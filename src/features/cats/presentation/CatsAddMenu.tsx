"use client";

import { TbPlus } from "react-icons/tb";
import { DropdownMenu } from "@/components/ui";
import { HouseholdIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { CatIcon } from "./CatIcon";

/** 猫一覧のヘッダーに置く、猫の登録と家の作成を選べるメニュー */
export function CatsAddMenu() {
  return (
    <DropdownMenu
      label="追加する"
      variant="primary"
      leftIcon={TbPlus}
      items={[
        { id: "cat", label: "猫を登録する", href: "/cats/new", icon: CatIcon },
        {
          id: "household",
          // 作成後は猫一覧へ戻す
          label: "家を作成する",
          href: "/settings/households/new?from=cats",
          icon: HouseholdIcon,
        },
      ]}
    />
  );
}
