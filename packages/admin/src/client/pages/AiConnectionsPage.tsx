import { Alert, Badge, Table } from "@canshi/shared/ui";
import { MCP_CLIENT_APP_LABEL } from "../../../../../src/features/mcp/domain/labels";
import {
  MCP_CLIENT_APP_ICON,
  UNKNOWN_MCP_CLIENT_ICON,
} from "../../../../../src/features/mcp/presentation/clientIcons";
import type { McpProviderJson, McpProvidersResponse } from "../../api/types";
import common from "../common.module.css";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { useApi } from "../useApi";
import styles from "./AiConnectionsPage.module.css";
import table from "./table.module.css";

/** 認可コードの渡し先が記録されていない接続のまとまりの表示 */
const NO_REDIRECT_HOST = "接続先の記録なし";

function providerKey(provider: McpProviderJson) {
  return provider.app
    ? `app:${provider.app}`
    : `host:${provider.redirectHost ?? ""}`;
}

function ProviderName(props: { provider: McpProviderJson }) {
  const { provider } = props;
  if (provider.app) {
    return (
      <span className={table.name}>{MCP_CLIENT_APP_LABEL[provider.app]}</span>
    );
  }
  return (
    <>
      <span className={table.name}>
        {provider.redirectHost ?? NO_REDIRECT_HOST}
      </span>
      <Badge color="warning">アイコン未設定</Badge>
      {provider.clientNames.length > 0 ? (
        <span className={common.sub}>
          名乗った名前：{provider.clientNames.join("、")}
        </span>
      ) : null}
    </>
  );
}

/**
 * AI のアプリ（MCP クライアント）のプロバイダーごとの接続の件数。アイコンはメインアプリの設定の
 * 「AIとの接続」と同じものを使い、アイコンを設定していないプロバイダーは接続先のホストごとに表示する
 */
export function AiConnectionsPage() {
  const { state, reload } = useApi<McpProvidersResponse>("/ai-connections");
  return (
    <Page title="AIとの接続">
      <p className={common.lead}>
        ユーザーが AI
        のアプリに許可した、有効な接続の件数をプロバイダーごとに表示します。プロバイダーは、メインアプリの設定の「AIとの接続」のアイコンと同じく、認可コードの渡し先のドメインで見分けます。
      </p>
      <Loadable state={state} reload={reload}>
        {({ providers }) => (
          <>
            {providers.some((provider) => provider.app === null) ? (
              <Alert color="warning" role="status">
                <p>
                  アイコンを設定していないプロバイダーとの接続があります。メインアプリの{" "}
                  <code className={styles.code}>
                    src/features/mcp/domain/clientApp.ts
                  </code>{" "}
                  にアプリと接続先のドメインを、
                  <code className={styles.code}>labels.ts</code> に表示名を、
                  <code className={styles.code}>
                    src/features/mcp/presentation/clientIcons.ts
                  </code>{" "}
                  にアイコンを追加してください。
                </p>
              </Alert>
            ) : null}
            <Table>
              <thead>
                <tr>
                  <th scope="col" className={styles.iconColumn}>
                    アイコン
                  </th>
                  <th scope="col">プロバイダー</th>
                  <th scope="col">接続件数</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider) => {
                  const Icon = provider.app
                    ? MCP_CLIENT_APP_ICON[provider.app]
                    : UNKNOWN_MCP_CLIENT_ICON;
                  return (
                    <tr key={providerKey(provider)}>
                      <td>
                        <span className={styles.icon}>
                          <Icon size={28} aria-hidden="true" />
                        </span>
                      </td>
                      <th scope="row" className={table.textColumn}>
                        <ProviderName provider={provider} />
                      </th>
                      <td className={common.num}>{provider.connectionCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </>
        )}
      </Loadable>
    </Page>
  );
}
