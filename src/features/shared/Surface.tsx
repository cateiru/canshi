import type { HTMLAttributes, ReactNode } from "react";
import { Heading } from "@/components/ui";
import styles from "./Surface.module.css";

type SurfaceProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  title?: ReactNode;
};

export function Surface({
  title,
  className,
  children,
  ...props
}: SurfaceProps) {
  return (
    <section
      className={[styles.surface, className].filter(Boolean).join(" ")}
      {...props}
    >
      {title ? (
        <Heading level={2} size="md" className={styles.title}>
          {title}
        </Heading>
      ) : null}
      {children}
    </section>
  );
}
