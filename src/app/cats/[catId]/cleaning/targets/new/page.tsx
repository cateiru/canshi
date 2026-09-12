import { notFound } from "next/navigation";
import { TbPlus, TbStack2 } from "react-icons/tb";
import { Breadcrumb, Button } from "@/components/ui";
import { BroomIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { CleaningTargetForm } from "@/features/cleaning/CleaningTargetForm";
import { CLEANING_TARGET_PRESETS } from "@/features/cleaning/presets";
import {
  createCleaningTargetAction,
  createCleaningTargetFromPresetAction,
} from "@/features/cleaning/targetActions";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type NewCleaningTargetPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewCleaningTargetPage({
  params,
}: NewCleaningTargetPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "掃除記録", href: `/cats/${catId}/cleaning` },
          { label: "対象を追加する" },
        ]}
      />

      <RecordPageHeading icon={BroomIcon}>
        {cat.name}の掃除対象を追加する
      </RecordPageHeading>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>
          <TbStack2 aria-hidden="true" size={18} />
          よく使う対象をワンタップで追加
        </h2>
        <div className={styles.presets}>
          {CLEANING_TARGET_PRESETS.map((preset) => (
            <form
              key={preset.name}
              action={createCleaningTargetFromPresetAction.bind(
                null,
                catId,
                preset.name,
                preset.frequencyValue,
                preset.frequencyUnit,
              )}
            >
              <Button type="submit" variant="secondary">
                {preset.name}を追加する
              </Button>
            </form>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>
          <TbPlus aria-hidden="true" size={18} />
          対象を作成する
        </h2>
        <CleaningTargetForm
          action={createCleaningTargetAction.bind(null, catId)}
          submitLabel="追加する"
        />
      </section>
    </main>
  );
}
