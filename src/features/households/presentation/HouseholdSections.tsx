import type { ReactNode } from "react";
import { Collapsible } from "@/components/ui";

type HouseholdGroup<T> = {
  household: { id: string; name: string };
  items: T[];
};

type HouseholdSectionsProps<T> = {
  groups: HouseholdGroup<T>[];
  /** 家ごとの開閉状態を保存する localStorage のキー */
  storageKey: (householdId: string) => string;
  /** 見出しの横に添える件数（`3件` など） */
  countLabel: (count: number) => string;
  /** 家が複数あるときに、家のまとまりを並べる要素に付けるクラス */
  className?: string;
  children: (group: HouseholdGroup<T>) => ReactNode;
};

/**
 * 家に属するデータの一覧を家ごとに表示する。所属する家が 1 つだけのときは、家の見出しを出さずに
 * その家の内容をそのまま表示する（家が 1 つの運用では、これまでの一覧と見た目を変えない）
 */
export function HouseholdSections<T>({
  groups,
  storageKey,
  countLabel,
  className,
  children,
}: HouseholdSectionsProps<T>) {
  const [onlyGroup] = groups;
  if (groups.length === 1 && onlyGroup) {
    return children(onlyGroup);
  }
  return (
    <div className={className}>
      {groups.map((group) => (
        <Collapsible
          key={group.household.id}
          title={group.household.name}
          titleAside={countLabel(group.items.length)}
          storageKey={storageKey(group.household.id)}
        >
          {children(group)}
        </Collapsible>
      ))}
    </div>
  );
}
