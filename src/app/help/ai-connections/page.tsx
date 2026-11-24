import type { Metadata } from "next";
import { HelpArticle } from "@/features/help/HelpArticle";
import { HelpCodeBlock } from "@/features/help/HelpCodeBlock";
import styles from "@/features/help/HelpContent.module.css";
import { HelpSteps } from "@/features/help/HelpSteps";
import { requestOrigin } from "@/features/help/requestOrigin";
import { getHelpTopic } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";

const SLUG = "ai-connections";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

/**
 * MCP サーバーのパス（`src/features/mcp/presentation/authorize.ts` の `MCP_API_ROUTE` と同じ）。
 * authorize.ts は Worker でしか読み込めないモジュールに依存するため、ここでは import しない
 */
const MCP_API_ROUTE = "/mcp";

export default async function AiConnectionsHelpPage() {
  const url = `${await requestOrigin()}${MCP_API_ROUTE}`;

  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <p>
          ChatGPT などの AI
          のアプリと接続すると、AIに話しかけるだけで、ねこの記録を確認したり記録したりできます。接続には、MCP（AI
          のアプリと外部のサービスをつなぐしくみ）を使います。
        </p>
      }
      related={["records", "api"]}
    >
      <Surface title="接続のしかた" gap="md">
        <HelpSteps
          steps={[
            {
              title: "AI のアプリで、MCP サーバー（コネクタ）を追加します",
              body: (
                <>
                  <p>
                    AI のアプリの設定で、MCP
                    サーバーやカスタムコネクタを追加する画面を開き、URL
                    に次の値を入力します。
                  </p>
                  <HelpCodeBlock code={url} />
                  <p>
                    追加する画面の場所や名前は、AI
                    のアプリによって異なります。くわしくは、お使いの AI
                    のアプリのヘルプを見てください。
                  </p>
                </>
              ),
            },
            {
              title: "CANSHI にログインし、AI に許可する範囲を選びます",
              body: (
                <>
                  <p>
                    接続を始めると CANSHI
                    の画面が開きます。ログインすると「AIとの接続」の画面が表示されるので、AI
                    に読ませたい家・ねこと、記録の種類ごとの「読む」「書く」を選びます。
                  </p>
                  <p>
                    チェックを入れた範囲だけを AI が操作できます。記録を AI
                    から追加したいときは「書く」にもチェックを入れてください。
                  </p>
                </>
              ),
              screenshot: {
                name: "ai-consent",
                alt: "AIとの接続の画面。接続を求めているアプリの名前と、許可する範囲のチェックボックスが並んでいる",
              },
            },
            {
              title: "「許可する」を押すと、接続が完了します",
              body: (
                <p>
                  AI
                  のアプリに戻ったら、「今週の体重の記録を教えて」「今朝のごはんを記録して」のように話しかけてみましょう。
                </p>
              ),
            },
          ]}
        />
      </Surface>

      <Surface title="接続を管理する" gap="md">
        <ul className={styles.points}>
          <li>
            設定の「外部接続」の「AIとの接続」で、接続しているアプリの一覧と、最後に接続した日時を確認できます。
          </li>
          <li>
            「許可する範囲」から、アプリごとに読み取れる情報と許可する操作をあとから変更できます。
          </li>
          <li>
            使わなくなった接続や、心当たりのない接続は、「AIとの接続」から解除してください。
          </li>
          <li>AI が追加・編集した記録も、だれが記録したかの履歴に残ります。</li>
        </ul>
      </Surface>
    </HelpArticle>
  );
}
