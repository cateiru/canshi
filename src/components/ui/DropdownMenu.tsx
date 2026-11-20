"use client";

import {
  type DropdownMenuProps,
  DropdownMenu as SharedDropdownMenu,
} from "@canshi/shared/ui";
import { useRouter } from "next/navigation";

/** メニュー項目の href を、全体の読み込みではなく Next.js のページ遷移で開く */
export function DropdownMenu(props: DropdownMenuProps) {
  const router = useRouter();
  return <SharedDropdownMenu navigate={router.push} {...props} />;
}
