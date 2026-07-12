"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { UiView } from "@/lib/types";

export type ModalState =
  | { type: "month" }
  | { type: "categoryManager" }
  | { type: "editMember"; memberId: string }
  | { type: "newSpace" }
  | { type: "invite" }
  | { type: "joinSpace" }
  | { type: "editEntry"; entryId: string }
  | { type: "unlock" }
  | { type: "activeSince" }
  | null;

type UIContextValue = {
  view: UiView;
  setView: (v: UiView) => void;
  modal: ModalState;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
};

const UIContext = createContext<UIContextValue | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<UiView>("Add");
  const [modal, setModal] = useState<ModalState>(null);

  return (
    <UIContext.Provider
      value={{
        view,
        setView,
        modal,
        openModal: setModal,
        closeModal: () => setModal(null),
      }}
    >
      {children}
    </UIContext.Provider>
  );
}
