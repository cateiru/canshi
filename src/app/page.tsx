import Link from "next/link";
import { Button } from "@/components/ui";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>CANSHI</h1>
      <p>愛猫の記録アプリ</p>
      <Link href="/cats">
        <Button variant="primary">猫一覧を見る</Button>
      </Link>
    </main>
  );
}
