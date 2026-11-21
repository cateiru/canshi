import type { LinkProps } from "@canshi/shared/ui";
import { Link } from "react-router";

/**
 * `@canshi/shared/ui` のリンクを含む部品（ButtonLink・Breadcrumb・FilterTabs など）に
 * `linkComponent` として渡す、react-router で画面を移動するリンク
 */
export function RouterLink({
  href,
  replace,
  transitionTypes: _transitionTypes,
  ...props
}: LinkProps) {
  return <Link to={href} replace={replace} {...props} />;
}
