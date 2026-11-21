import { Alert } from "@canshi/shared/ui";
import type { OverviewResponse } from "../../api/types";
import { Loadable } from "../components/Loadable";
import { Page } from "../components/Page";
import { useApi } from "../useApi";
import styles from "./OverviewPage.module.css";

export function OverviewPage() {
  const { state, reload } = useApi<OverviewResponse>("/overview");
  return (
    <Page title="概要">
      <Loadable state={state} reload={reload}>
        {(overview) => (
          <>
            <dl className={styles.stats}>
              <div className={styles.stat}>
                <dt>ユーザー</dt>
                <dd>{overview.userCount}</dd>
              </div>
              <div className={styles.stat}>
                <dt>家</dt>
                <dd>{overview.householdCount}</dd>
              </div>
              <div className={styles.stat}>
                <dt>猫</dt>
                <dd>{overview.catCount}</dd>
              </div>
              <div className={styles.stat}>
                <dt>家に未所属の猫</dt>
                <dd>{overview.unassignedCatCount}</dd>
              </div>
            </dl>
            {overview.unassignedCatCount > 0 ? (
              <Alert color="warning" role="status">
                <p>
                  家に所属していない猫が {overview.unassignedCatCount}{" "}
                  匹います。どのユーザーからも表示されないため、
                  <code className={styles.code}>
                    pnpm household:link --remote
                  </code>
                  （ローカルの D1 では{" "}
                  <code className={styles.code}>--local</code>
                  ）で家に紐付けてください。
                </p>
              </Alert>
            ) : null}
          </>
        )}
      </Loadable>
    </Page>
  );
}
