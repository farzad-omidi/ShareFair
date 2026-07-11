"use client";

import type { ReactNode } from "react";

export function ModalSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="modal-bg active"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">{children}</div>
    </div>
  );
}
