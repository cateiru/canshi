"use client";

import { usePathname } from "next/navigation";
import { IconButtonLink } from "@/components/ui";
import { HelpIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { helpSlugForPath } from "./contextualHelp";
import { HELP_INDEX_HREF, helpHref } from "./topics";

type HeaderHelpLinkProps = {
  className?: string;
};

/**
 * ヘッダーに置くヘルプへのリンク。開いている画面の使い方を説明する記事があればその記事へ、
 * なければヘルプの一覧へ進める
 */
export function HeaderHelpLink({ className }: HeaderHelpLinkProps) {
  const slug = helpSlugForPath(usePathname());
  const label = slug ? "この画面のヘルプ" : "ヘルプ";

  return (
    <IconButtonLink
      href={slug ? helpHref(slug) : HELP_INDEX_HREF}
      icon={HelpIcon}
      className={className}
      aria-label={label}
      title={label}
    />
  );
}
