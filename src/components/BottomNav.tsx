"use client";

import { useRef } from "react";
import { useUI } from "@/lib/ui";
import { useSpace } from "@/lib/store";
import { useLanguage } from "@/lib/i18n/context";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { UiView } from "@/lib/types";
import { IconPlus, IconGrid, IconSwap, IconPulse, IconDots } from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

const DOUBLE_TAP_MS = 350;

const items: { view: UiView; Icon: ComponentType<SVGProps<SVGSVGElement>>; labelKey: TranslationKey }[] = [
  { view: "Add", Icon: IconPlus, labelKey: "nav_add" },
  { view: "Month", Icon: IconGrid, labelKey: "nav_month" },
  { view: "Settle", Icon: IconSwap, labelKey: "nav_settle" },
  { view: "Insights", Icon: IconPulse, labelKey: "nav_insights" },
  { view: "More", Icon: IconDots, labelKey: "nav_more" },
];

export function BottomNav() {
  const { view, setView } = useUI();
  const { entries, profile, myInvitations } = useSpace();
  const { t } = useLanguage();
  const lastTap = useRef<{ view: UiView; time: number } | null>(null);

  const awaitingMe = profile
    ? entries.filter(
        (e) =>
          (e.kind === "settlement" &&
            e.status === "pending" &&
            e.created_by !== profile.id &&
            (e.from_id === profile.id || e.to_id === profile.id)) ||
          (e.kind === "request" && e.from_id === profile.id)
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
            {item.view === "More" && myInvitations.length > 0 && <span className="nav-badge" />}
          </span>
          <span>{t(item.labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}
