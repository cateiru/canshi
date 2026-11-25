import type { Metadata } from "next";
import { Heading } from "@/components/ui";
import {
  API_BASE_PATH,
  API_OPENAPI_PATH,
  API_ROUTE_GROUPS,
} from "@/features/api/domain/routes";
import { HelpArticle } from "@/features/help/HelpArticle";
import { HelpCodeBlock } from "@/features/help/HelpCodeBlock";
import helpStyles from "@/features/help/HelpContent.module.css";
import { HelpSteps } from "@/features/help/HelpSteps";
import { requestOrigin } from "@/features/help/requestOrigin";
import { getHelpTopic } from "@/features/help/topics";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

const SLUG = "api";

export const metadata: Metadata = {
  title: getHelpTopic(SLUG).title,
};

export default async function ApiHelpPage() {
  const baseUrl = `${await requestOrigin()}${API_BASE_PATH}`;
  const example = `curl ${baseUrl}/cats \\
  -H "Authorization: Bearer <トークン>"`;
  const writeExample = `curl -X POST ${baseUrl}/cats/<ねこのID>/weight-records \\
  -H "Authorization: Bearer <トークン>" \\
  -H "Content-Type: application/json" \\
  -d '{"catWeightKg": 4.2}'`;

  return (
    <HelpArticle
      slug={SLUG}
      lead={
        <p>
          API
          を使うと、自分で作ったプログラムなどから、ねこの記録を読んだり追加したりできます。プログラムを作る人向けの機能です。ChatGPT
          などの AI のアプリから使うときは、API
          ではなく「AIとの接続」を使ってください。
        </p>
      }
      related={["ai-connections", "records"]}
    >
      <Surface title="使いはじめる" gap="md">
        <HelpSteps
          steps={[
            {
              title: "API トークンを発行します",
              body: (
                <>
                  <p>
                    設定の「外部接続」の「APIトークン」を開き、「トークンを発行する」を押します。トークンの名前と有効期限、許可する範囲を選びます。
                  </p>
                  <p>
                    ごはん商品・ごはんプリセット・メモのラベルなど、家ごとの操作も使うときは、家の「詳細な設定」を開き、許可する操作にチェックを入れてください。
                  </p>
                  <p>
                    発行したトークンは、そのときにしか表示されません。安全な場所に保存し、ほかの人に見せないでください。
                  </p>
                </>
              ),
              screenshot: {
                name: "api-token-new",
                alt: "APIトークンを発行する画面。トークンの名前と有効期限、許可する範囲のチェックボックスが並んでいる",
              },
            },
            {
              title: "トークンを付けて API を呼びます",
              body: (
                <>
                  <p>
                    リクエストの Authorization
                    ヘッダーに、「Bearer」に続けてトークンを指定します。次の例では、ねこの一覧を取得します。
                  </p>
                  <HelpCodeBlock code={example} />
                  <p>
                    追加・編集するときは、内容を JSON
                    で送ります。次の例では、体重の記録を追加します。
                  </p>
                  <HelpCodeBlock code={writeExample} />
                </>
              ),
            },
          ]}
        />
      </Surface>

      <Surface title="API の決まり" gap="md">
        <ul className={helpStyles.points}>
          <li>
            応答は JSON です。失敗したときは HTTP のステータスが 400
            以上になり、本文の error
            に、エラーの種類（code）と説明（message）が入ります。
          </li>
          <li>
            GET と DELETE の項目はクエリで、それ以外は本文の JSON
            で指定します。パスの {"{catId}"} などには ID を入れます。
          </li>
          <li>日付・時刻は日本時間で指定します。</li>
          <li>
            使えるのは、トークンに許可した家・ねこ・記録と操作だけです。許可していないねこは、存在しないねこと同じ扱いになります。
          </li>
          <li>
            項目ごとのくわしい説明は、OpenAPI 形式の仕様にあります。次の URL
            は、トークンなしで読めます。
          </li>
        </ul>
        <HelpCodeBlock code={`${baseUrl}${API_OPENAPI_PATH}`} />
      </Surface>

      <Surface title="エンドポイント" gap="md">
        <p>パスは {baseUrl} に続けて指定します。</p>
        {API_ROUTE_GROUPS.map((group) => (
          <section
            key={group.label}
            aria-label={group.label}
            className={styles.group}
          >
            <Heading level={3} size="md">
              {group.label}
            </Heading>
            <ul className={styles.routes}>
              {group.routes.map((route) => (
                <li key={route.operation} className={styles.route}>
                  <code className={styles.endpoint}>
                    <span className={styles.method}>{route.method}</span>
                    {route.path}
                  </code>
                  <span className={styles.summary}>{route.summary}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Surface>

      <Surface title="トークンを管理する" gap="md">
        <ul className={helpStyles.points}>
          <li>
            設定の「外部接続」の「APIトークン」で、発行したトークンの一覧と、有効期限・最後に使った日時を確認できます。
          </li>
          <li>
            「許可する範囲」から、トークンごとに読み取れる情報と許可する操作をあとから変更できます。有効期限は変更できないため、新しいトークンを発行してください。
          </li>
          <li>
            使わなくなったトークンや、漏れたおそれのあるトークンは削除してください。すぐに使えなくなります。
          </li>
          <li>
            不正な利用を調べられるよう、API を呼んだ日時・IP
            アドレス・User-Agent
            などを記録しています。トークンを削除すると、この記録も消えます。
          </li>
        </ul>
      </Surface>
    </HelpArticle>
  );
}
