import type { ReactNode } from "react";
import { TbArrowLeft } from "react-icons/tb";
import { Breadcrumb, ButtonLink, NavCard } from "@/components/ui";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./HelpArticle.module.css";
import { getHelpTopic, HELP_INDEX_HREF, helpHref } from "./topics";

type HelpArticleProps = {
  /** 記事の slug。見出し・アイコン・パンくずはヘルプの一覧（`topics.ts`）の内容を使う */
  slug: string;
  /** 見出しのすぐ下に出す、記事の要約 */
  lead: ReactNode;
  children: ReactNode;
  /** あわせて読むとよい記事の slug */
  related?: string[];
  /** パンくずで「ヘルプ」と記事の間に挟む親の記事の slug（記録ごとのヘルプなど） */
  parentSlug?: string;
};

/** ヘルプの記事（`/help/*`）の共通の枠。ログインしていなくても見られるよう、ユーザーの情報は使わない */
export function HelpArticle({
  slug,
  lead,
  children,
  related = [],
  parentSlug,
}: HelpArticleProps) {
  const topic = getHelpTopic(slug);
  const parent = parentSlug ? getHelpTopic(parentSlug) : null;

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ヘルプ", href: HELP_INDEX_HREF },
          ...(parent
            ? [{ label: parent.title, href: helpHref(parent.slug) }]
            : []),
          { label: topic.title },
        ]}
      />

      <RecordPageHeading icon={topic.icon}>{topic.title}</RecordPageHeading>
      <div className={styles.lead}>{lead}</div>

      {children}

      {related.length > 0 ? (
        <nav aria-labelledby="help-related-heading" className={styles.related}>
          <h2 id="help-related-heading" className={styles.relatedHeading}>
            関連するヘルプ
          </h2>
          <ul className={styles.relatedList}>
            {related.map((relatedSlug) => {
              const relatedTopic = getHelpTopic(relatedSlug);
              return (
                <li key={relatedSlug}>
                  <NavCard
                    href={helpHref(relatedSlug)}
                    icon={relatedTopic.icon}
                    title={relatedTopic.title}
                    titleAs="h3"
                    description={relatedTopic.description}
                  />
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <div>
        <ButtonLink href={HELP_INDEX_HREF} leftIcon={TbArrowLeft}>
          ヘルプの一覧へ戻る
        </ButtonLink>
      </div>
    </main>
  );
}
