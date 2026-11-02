"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Native modal dialog: focus is trapped, Escape closes it and focus returns to the opener. */
export function ConfirmDialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop (the dialog itself, outside its content) closes it.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-body">
        <h2 id="confirm-dialog-title">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
