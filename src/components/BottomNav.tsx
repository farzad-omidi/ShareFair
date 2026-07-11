"use client";

import { useUI } from "@/lib/ui";
import type { UiView } from "@/lib/types";

const items: { view: UiView; icon: string; label: string }[] = [
  { view: "Add", icon: "＋", label: "Add" },
  { view: "Month", icon: "⌂", label: "Month" },
  { view: "Settle", icon: "↔", label: "Settle" },
  { view: "Insights", icon: "∿", label: "Rhythm" },
  { view: "More", icon: "⋯", label: "More" },
];

export function BottomNav() {
  const { view, setView } = useUI();
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.view}
          className={view === item.view ? "active" : ""}
          onClick={() => setView(item.view)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
