"use client";

import { useUI } from "@/lib/ui";
import type { UiView } from "@/lib/types";
import { IconPlus, IconGrid, IconSwap, IconPulse, IconDots } from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

const items: { view: UiView; Icon: ComponentType<SVGProps<SVGSVGElement>>; label: string }[] = [
  { view: "Add", Icon: IconPlus, label: "Add" },
  { view: "Month", Icon: IconGrid, label: "Month" },
  { view: "Settle", Icon: IconSwap, label: "Settle" },
  { view: "Insights", Icon: IconPulse, label: "Rhythm" },
  { view: "More", Icon: IconDots, label: "More" },
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
          <item.Icon />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
