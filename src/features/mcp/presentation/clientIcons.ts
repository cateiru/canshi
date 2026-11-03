import type { IconType } from "react-icons";
import {
  RiClaudeFill,
  RiGeminiFill,
  RiMetaFill,
  RiOpenaiFill,
  RiPerplexityFill,
} from "react-icons/ri";
import { TbPlugConnected } from "react-icons/tb";

/**
 * 接続先（認可コードの渡し先）のドメインごとに表示するアプリのアイコン。
 * ドメインはそのものか、そのサブドメインに一致させる
 */
const CLIENT_ICONS: readonly { domains: readonly string[]; icon: IconType }[] =
  [
    { domains: ["chatgpt.com", "openai.com"], icon: RiOpenaiFill },
    { domains: ["claude.ai", "claude.com"], icon: RiClaudeFill },
    { domains: ["meta.ai"], icon: RiMetaFill },
    { domains: ["gemini.google.com"], icon: RiGeminiFill },
    { domains: ["perplexity.ai"], icon: RiPerplexityFill },
  ];

/**
 * 接続しているアプリのアイコンを、認可コードの渡し先から決める。アプリの名前は
 * 自己申告なので使わない。渡し先のドメインは、そこへ認可コードを渡す以上、名乗りだけで
 * 偽ることはできない。わからないアプリ・アプリのスキームは共通のアイコンにする
 */
export function getMcpClientIcon(redirectUri: string | null): IconType {
  if (!redirectUri) {
    return TbPlugConnected;
  }
  let hostname: string;
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "https:") {
      return TbPlugConnected;
    }
    hostname = url.hostname;
  } catch {
    return TbPlugConnected;
  }
  const matched = CLIENT_ICONS.find(({ domains }) =>
    domains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    ),
  );
  return matched?.icon ?? TbPlugConnected;
}
