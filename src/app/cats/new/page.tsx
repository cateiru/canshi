import { Breadcrumb } from "@/components/ui";
import { createCatAction } from "@/features/cats/actions";
import { CatForm } from "@/features/cats/CatForm";
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

      <h1>猫を登録する</h1>
      <CatForm action={createCatAction} submitLabel="登録する" />
    </main>
  );
}
