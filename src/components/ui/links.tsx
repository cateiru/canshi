// `@canshi/shared/ui` のリンクを含むコンポーネントに、Next.js のリンク（`next/link`）を差し込む。
// Server Component からも使えるよう、Context ではなく props（`linkComponent`）で渡す
import {
  type BreadcrumbProps,
  type ButtonLinkProps,
  type FilterTabsProps,
  type FooterProps,
  type IconButtonLinkProps,
  type LinkComponent,
  type MonthNavProps,
  type NavCardProps,
  type PaginationProps,
  Breadcrumb as SharedBreadcrumb,
  ButtonLink as SharedButtonLink,
  FilterTabs as SharedFilterTabs,
  Footer as SharedFooter,
  IconButtonLink as SharedIconButtonLink,
  MonthNav as SharedMonthNav,
  NavCard as SharedNavCard,
  Pagination as SharedPagination,
} from "@canshi/shared/ui";
import NextLink from "next/link";
import { version } from "../../../package.json";

const Link: LinkComponent = NextLink;

export function ButtonLink(props: ButtonLinkProps) {
  return <SharedButtonLink linkComponent={Link} {...props} />;
}

export function IconButtonLink(props: IconButtonLinkProps) {
  return <SharedIconButtonLink linkComponent={Link} {...props} />;
}

export function NavCard(props: NavCardProps) {
  return <SharedNavCard linkComponent={Link} {...props} />;
}

export function Breadcrumb(props: BreadcrumbProps) {
  return <SharedBreadcrumb linkComponent={Link} {...props} />;
}

export function FilterTabs(props: FilterTabsProps) {
  return <SharedFilterTabs linkComponent={Link} {...props} />;
}

export function Pagination(props: PaginationProps) {
  return <SharedPagination linkComponent={Link} {...props} />;
}

export function MonthNav(props: MonthNavProps) {
  return <SharedMonthNav linkComponent={Link} {...props} />;
}

/** バージョンはこのアプリの `package.json` の `version` を表示する */
export function Footer(props: Omit<FooterProps, "version">) {
  return <SharedFooter linkComponent={Link} version={version} {...props} />;
}
