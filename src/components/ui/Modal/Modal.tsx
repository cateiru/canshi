"use client";

import type { ReactNode } from "react";
import {
  Modal as AriaModal,
  Dialog,
  Heading,
  ModalOverlay,
} from "react-aria-components";
import { CatEarFrame } from "../CatEarFrame/CatEarFrame";
import styles from "./Modal.module.css";

export type ModalSize = "md" | "lg";

export type ModalProps = {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  /** md: 確認ダイアログ向け（既定）。lg: 画像・動画の表示など幅を広く使う用途向け */
  size?: ModalSize;
  children: ReactNode;
};

export function Modal({
  open,
  title,
  onClose,
  size = "md",
  children,
}: ModalProps) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      isDismissable
      className={styles.overlay}
    >
      <AriaModal className={`${styles.modal} ${styles[size]}`}>
        <Dialog className={styles.dialog}>
          <CatEarFrame className={styles.panel}>
            <div className={styles.scrollArea}>
              {title ? (
                <Heading slot="title" className={styles.title}>
                  {title}
                </Heading>
              ) : null}
              {children}
            </div>
          </CatEarFrame>
        </Dialog>
      </AriaModal>
    </ModalOverlay>
  );
}
