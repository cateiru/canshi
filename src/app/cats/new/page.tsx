import { createCatAction } from "@/features/cats/actions";
import { CatForm } from "@/features/cats/CatForm";
import styles from "../page.module.css";

export default function NewCatPage() {
  return (
    <main className={styles.main}>
      <h1>猫を登録する</h1>
      <CatForm action={createCatAction} submitLabel="登録する" />
    </main>
  );
}
