import { ApiTokenIcon } from "@canshi/shared/ui/RecordIcons";
import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { ApiTokenForm } from "@/features/api/presentation/ApiTokenForm";
import { createApiTokenAction } from "@/features/api/presentation/actions";
import { API_TOKENS_PATH } from "@/features/api/presentation/paths";
import { requireUser } from "@/features/auth/presentation/session";
import { DEFAULT_PERMISSIONS } from "@/features/external-access/domain/permissionRules";
import { getPermissionTree } from "@/features/external-access/infrastructure/permissions";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "APIトークンを発行する",
};

export const dynamic = "force-dynamic";

/** API トークンの名前・有効期限・許可する範囲を選んで発行するページ */
export default async function NewApiTokenPage() {
  const user = await requireUser();
  const tree = await getPermissionTree(user.id, DEFAULT_PERMISSIONS);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "外部接続", href: "/settings/external-connections" },
          { label: "APIトークン", href: API_TOKENS_PATH },
          { label: "トークンを発行する" },
        ]}
      />

      <RecordPageHeading icon={ApiTokenIcon}>
        APIトークンを発行する
      </RecordPageHeading>

      <ApiTokenForm action={createApiTokenAction} tree={tree} />
    </main>
  );
}
