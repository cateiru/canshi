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

export type ModalProps = {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: ModalProps) {
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
      <AriaModal className={styles.modal}>
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
