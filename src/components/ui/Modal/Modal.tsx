"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { CatEarFrame } from "../CatEarFrame/CatEarFrame";
import styles from "./Modal.module.css";

export type ModalProps = {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: オーバーレイのクリック閉じは Escape キーでも代替できる
    // biome-ignore lint/a11y/noStaticElementInteractions: モーダルオーバーレイの外側クリックによる閉じるための実装
    <div className={styles.overlay} onClick={onClose}>
      <CatEarFrame
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? <div className={styles.title}>{title}</div> : null}
        {children}
      </CatEarFrame>
    </div>
  );
}
