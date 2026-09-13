import { Breadcrumb } from "@/components/ui";
import { createCatAction } from "@/features/cats/actions";
import { CatForm } from "@/features/cats/CatForm";
import { CatIcon } from "@/features/cats/CatIcon";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export default function NewCatPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: "猫を登録する" },
        ]}
      />

      <RecordPageHeading icon={CatIcon}>猫を登録する</RecordPageHeading>
      <p>名前や誕生日を登録して、毎日の記録をはじめましょう。</p>
      <CatForm action={createCatAction} submitLabel="登録する" />
    </main>
  );
}
