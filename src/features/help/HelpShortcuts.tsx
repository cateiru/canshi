import { cache } from "react";
import { TbChevronRight } from "react-icons/tb";
import { ButtonLink } from "@/components/ui";
import { getCurrentUser } from "@/features/auth/presentation/session";
import {
  listCatsForUser,
  listHouseholdsForUser,
} from "@/features/households/infrastructure/queries";
import styles from "./HelpShortcuts.module.css";
import {
  buildHelpShortcuts,
  type HelpShortcutContext,
  type HelpShortcutTarget,
} from "./shortcuts";

/** ログイン中のユーザーの家・ねこ。1 つの記事で複数の手順に導線を出すため、リクエストごとに 1 回だけ読む */
const loadHelpShortcutContext = cache(
  async (): Promise<HelpShortcutContext> => {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }
    const [households, cats] = await Promise.all([
      listHouseholdsForUser(user.id),
      listCatsForUser(user.id),
    ]);
    return { households, cats };
  },
);

type HelpShortcutsProps = {
  target: HelpShortcutTarget;
};

/**
 * ヘルプの手順に添える、ログイン中のユーザーの家・ねこの画面への導線（`shortcuts.ts`）。
 * ログインしていないときや、開く先がないときは何も出さない
 */
export async function HelpShortcuts({ target }: HelpShortcutsProps) {
  const shortcuts = buildHelpShortcuts(target, await loadHelpShortcutContext());
  if (shortcuts.length === 0) {
    return null;
  }

  return (
    <ul className={styles.list}>
      {shortcuts.map((shortcut) => (
        <li key={shortcut.href}>
          <ButtonLink href={shortcut.href} rightIcon={TbChevronRight}>
            {shortcut.label}
          </ButtonLink>
        </li>
      ))}
    </ul>
  );
}
