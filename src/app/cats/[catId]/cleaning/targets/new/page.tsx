import { notFound } from "next/navigation";
import { Breadcrumb, Button, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { CleaningTargetForm } from "@/features/cleaning/CleaningTargetForm";
import { CLEANING_TARGET_PRESETS } from "@/features/cleaning/presets";
import {
  createCleaningTargetAction,
  createCleaningTargetFromPresetAction,
} from "@/features/cleaning/targetActions";
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
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "掃除記録", href: `/cats/${catId}/cleaning` },
          { label: "対象を追加する" },
        ]}
      />

      <h1>{cat.name}の掃除対象を追加する</h1>

      <Card title="よく使う対象をワンタップで追加">
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
      </Card>

      <Card title="対象を作成する">
        <CleaningTargetForm
          action={createCleaningTargetAction.bind(null, catId)}
          submitLabel="追加する"
        />
      </Card>
    </main>
  );
}
