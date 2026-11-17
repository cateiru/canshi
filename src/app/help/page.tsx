import type { Metadata } from "next";
import { Breadcrumb, NavCard } from "@/components/ui";
import {
  CatFaceIcon,
  FoodProductIcon,
  HelpIcon,
  HouseholdIcon,
  ReleaseNotesIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import { HelpFlow, type HelpFlowStep } from "@/features/help/HelpFlow";
import { HELP_CATEGORIES, helpHref } from "@/features/help/topics";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ヘルプ",
};

/** はじめて使うときに進める順。それぞれの記事へ進める */
const GETTING_STARTED_STEPS: HelpFlowStep[] = [
  {
    icon: HouseholdIcon,
    title: "家を作る",
    description: "家族も招待できます",
    href: helpHref("create-household"),
  },
  {
    icon: CatFaceIcon,
    title: "ねこを登録する",
    description: "名前だけで登録できます",
    href: helpHref("add-cat"),
  },
  {
    icon: FoodProductIcon,
    title: "ごはんを登録する",
    description: "いつものごはんを家に登録",
    href: helpHref("household-food"),
  },
  {
    icon: ReleaseNotesIcon,
    title: "記録をつける",
    description: "ごはん・うんち・体重など",
    href: helpHref("records"),
  },
];

/** ヘルプの一覧。ログインしていなくても見られる（`src/features/auth/domain/publicPaths.ts`） */
export default function HelpIndexPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/home" }, { label: "ヘルプ" }]}
      />

      <RecordPageHeading icon={HelpIcon}>ヘルプ</RecordPageHeading>
      <p>
        CANSHI
        の使い方をまとめています。はじめて使うときは、次の順に進めるのがおすすめです。
      </p>

      <section
        aria-labelledby="help-getting-started-flow"
        className={styles.category}
      >
        <h2 id="help-getting-started-flow" className={styles.categoryTitle}>
          はじめての流れ
        </h2>
        <HelpFlow
          numbered
          aria-label="はじめての流れ"
          steps={GETTING_STARTED_STEPS}
        />
      </section>

      {HELP_CATEGORIES.map((category) => (
        <section
          key={category.id}
          aria-labelledby={`help-category-${category.id}`}
          className={styles.category}
        >
          <h2
            id={`help-category-${category.id}`}
            className={styles.categoryTitle}
          >
            {category.title}
          </h2>
          <ul className={styles.list}>
            {category.topics.map((topic) => (
              <li key={topic.slug}>
                <NavCard
                  href={helpHref(topic.slug)}
                  icon={topic.icon}
                  title={topic.title}
                  titleAs="h3"
                  description={topic.description}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
