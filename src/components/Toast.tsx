"use client";

import { useSpace } from "@/lib/store";

export function Toast() {
  const { toast } = useSpace();
  return <div className={`toast${toast ? " show" : ""}`}>{toast}</div>;
}
