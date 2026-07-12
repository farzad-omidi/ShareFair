"use client";

import { useRef } from "react";
import { useUI } from "@/lib/ui";
import { useSpace } from "@/lib/store";
import type { UiView } from "@/lib/types";
import { IconPlus, IconGrid, IconSwap, IconPulse, IconDots } from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

const DOUBLE_TAP_MS = 350;

const items: { view: UiView; Icon: ComponentType<SVGProps<SVGSVGElement>>; label: string }[] = [
  { view: "Add", Icon: IconPlus, label: "Add" },
  { view: "Month", Icon: IconGrid, label: "Month" },
  { view: "Settle", Icon: IconSwap, label: "Settle" },
  { view: "Insights", Icon: IconPulse, label: "Rhythm" },
  { view: "More", Icon: IconDots, label: "More" },
];

export function BottomNav() {
  const { view, setView } = useUI();
  const { entries, profile } = useSpace();
  const lastTap = useRef<{ view: UiView; time: number } | null>(null);

  const awaitingMe = profile
    ? entries.filter(
        (e) =>
          e.kind === "settlement" &&
          e.status === "pending" &&
          e.created_by !== profile.id &&
          (e.from_id === profile.id || e.to_id === profile.id)
      ).length
    : 0;

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.view}
          className={view === item.view ? "active" : ""}
          onClick={() => {
            const now = Date.now();
            // A second tap on the tab you're already on, in quick succession,
            // jumps that view back to its top instead of doing nothing.
            const isDoubleTap =
              lastTap.current?.view === item.view && now - lastTap.current.time < DOUBLE_TAP_MS;
            setView(item.view);
            if (isDoubleTap) window.scrollTo({ top: 0, behavior: "smooth" });
            lastTap.current = { view: item.view, time: now };
          }}
        >
          <span className="nav-ico">
            <item.Icon />
            {item.view === "Settle" && awaitingMe > 0 && <span className="nav-badge" />}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
