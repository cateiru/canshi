import { ButtonLink } from "@canshi/shared/ui";
import common from "../common.module.css";
import { Page } from "../components/Page";
import { RouterLink } from "../RouterLink";

export function NotFoundPage(props: { message?: string }) {
  return (
    <Page title="ページが見つかりません">
      <p className={common.lead}>
        {props.message ?? "URL が正しいか確かめてください。"}
      </p>
      <div>
        <ButtonLink href="/" linkComponent={RouterLink}>
          概要へ戻る
        </ButtonLink>
      </div>
    </Page>
  );
}
