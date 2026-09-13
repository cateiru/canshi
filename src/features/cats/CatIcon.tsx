import type { IconBaseProps } from "react-icons";

/** CANSHI の丸い輪郭と、まっすぐ見守る目を使った猫のマーク。 */
export function CatIcon({ size = "1em", ...props }: IconBaseProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      {...props}
    >
      <path
        d="M5.5 15V5.8c0-.8.6-1.1 1.2-.6l5.1 3.6a17 17 0 0 1 8.4 0l5.1-3.6c.6-.5 1.2-.2 1.2.6V15c1.1 1.5 1.6 3.1 1.3 4.9C27.2 24.6 22.4 27 16 27S4.8 24.6 4.2 19.9c-.3-1.8.2-3.4 1.3-4.9Z"
        fill="currentColor"
      />
      <path
        d="m8 8.4 3 2.2-3 .8Zm16 0-3 2.2 3 .8Z"
        fill="var(--color-accent)"
      />
      <rect
        x="10"
        y="15"
        width="3"
        height="5"
        rx="1.5"
        fill="var(--color-bg)"
      />
      <rect
        x="19"
        y="15"
        width="3"
        height="5"
        rx="1.5"
        fill="var(--color-bg)"
      />
      <path
        d="M14.5 22h3L16 23.5Z"
        fill="var(--color-accent)"
        stroke="var(--color-accent)"
        strokeLinejoin="round"
      />
    </svg>
  );
}
