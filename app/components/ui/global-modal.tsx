"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/app/components/ui/utils";

type GlobalModalProps = {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: ReactNode;
  panelClassName?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
};

export function GlobalModal({
  open,
  onClose,
  titleId,
  children,
  panelClassName,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: GlobalModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !closeOnEscape) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOnEscape, onClose, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="global-modal-overlay"
      role="presentation"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("global-modal-panel", panelClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
