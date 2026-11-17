import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticle } from "@/features/help/HelpArticle";
import styles from "@/features/help/HelpContent.module.css";
import { HelpScreenshot } from "@/features/help/HelpScreenshot";
import { findRecordHelp, RECORD_HELPS } from "@/features/help/recordHelps";
import { recordHelpSlug } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

type RecordHelpPageProps = {
  params: Promise<{ recordType: string }>;
};

/** 定義した記録の種類だけをページにする */
export const dynamicParams = false;

export function generateStaticParams() {
  return RECORD_HELPS.map((record) => ({ recordType: record.recordType }));
}

export async function generateMetadata({
  params,
}: RecordHelpPageProps): Promise<Metadata> {
  const { recordType } = await params;
  const record = findRecordHelp(recordType);
  return record ? { title: record.title } : {};
}

/** 記録の種類ごとのヘルプ。中身は `src/features/help/recordHelps.ts` に書く */
export default async function RecordHelpPage({ params }: RecordHelpPageProps) {
  const { recordType } = await params;
  const record = findRecordHelp(recordType);
  if (!record) {
    notFound();
  }

  return (
    <HelpArticle
      slug={recordHelpSlug(record.recordType)}
      parentSlug="records"
      lead={<p>{record.lead}</p>}
      related={["records", ...(record.related ?? [])]}
    >
      <HelpScreenshot
        name={record.screenshot.name}
        alt={record.screenshot.alt}
        caption={record.screenshot.caption}
      />

      <Surface title="記録できる項目" gap="md">
        <dl className={styles.terms}>
          {record.fields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.description}</dd>
            </div>
          ))}
        </dl>
      </Surface>

      {record.tips.length > 0 ? (
        <Surface title="ポイント" gap="md">
          <ul className={styles.points}>
            {record.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </Surface>
      ) : null}
    </HelpArticle>
  );
}
