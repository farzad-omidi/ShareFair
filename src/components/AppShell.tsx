"use client";

import { useEffect, useRef } from "react";
import { SpaceProvider, useSpace } from "@/lib/store";
import { UIProvider, useUI } from "@/lib/ui";
import { useLanguage } from "@/lib/i18n/context";
import { monthName } from "@/lib/domain";
import { Onboarding } from "@/components/Onboarding";
import { Splash } from "@/components/Splash";
import { Confetti } from "@/components/Confetti";
import { BottomNav } from "@/components/BottomNav";
import { Toast } from "@/components/Toast";
import { ModalHost } from "@/components/ModalHost";
import { NotificationBanner } from "@/components/NotificationBanner";
import { AddView } from "@/components/views/AddView";
import { MonthView } from "@/components/views/MonthView";
import { SettleView } from "@/components/views/SettleView";
import { InsightsView } from "@/components/views/InsightsView";
import { MoreView } from "@/components/views/MoreView";

export function AppShell({ userId, userEmail }: { userId: string; userEmail: string }) {
  return (
    <SpaceProvider userId={userId} userEmail={userEmail}>
      <UIProvider>
        <AppShellInner />
      </UIProvider>
    </SpaceProvider>
  );
}

function AppShellInner() {
  const { loading, activeSpace, spaces, members, selectedMonth, realtimeStatus, profile, celebration } = useSpace();
  const { view, openModal } = useUI();
  const { t } = useLanguage();

  // Ask a brand-new member since when they've actually been involved, once per
  // session -- existing members were backfilled at migration time, so a null
  // active_since only ever means "just joined, hasn't answered yet."
  const askedActiveSinceRef = useRef(false);
  useEffect(() => {
    if (askedActiveSinceRef.current || !activeSpace || !profile) return;
    const mine = members.find((m) => m.user_id === profile.id);
    if (mine && mine.active_since === null) {
      askedActiveSinceRef.current = true;
      openModal({ type: "activeSince" });
    }
  }, [activeSpace, profile, members, openModal]);

  if (loading) {
    return <Splash />;
  }

  if (!activeSpace || spaces.length === 0) {
    return <Onboarding />;
  }

  return (
    <div>
      <div className="glow" />
      <main className="app-shell">
        {celebration.length > 0 && <Confetti pieces={celebration} />}
        <header className="app-header">
          <div>
            <div className="eyebrow">{t("header_eyebrow", { count: members.length, currency: activeSpace.currency })}</div>
            <h1 className="brand">{activeSpace.name}</h1>
          </div>
          <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
            <button className="pill" onClick={() => openModal({ type: "month" })}>
              <span>{monthName(selectedMonth, true)}</span>
              <small>⌄</small>
            </button>
            <span className={`status ${realtimeStatus === "live" ? "green" : "neutral"}`}>
              <span className="s-dot"></span>
              <span>
                {realtimeStatus === "live"
                  ? t("status_live")
                  : realtimeStatus === "connecting"
                    ? t("status_connecting")
                    : t("status_offline")}
              </span>
            </span>
          </div>
        </header>

        <div className={`view${view === "Add" ? " active" : ""}`}>
          <AddView />
        </div>
        <div className={`view${view === "Month" ? " active" : ""}`}>
          <MonthView />
        </div>
        <div className={`view${view === "Settle" ? " active" : ""}`}>
          <SettleView />
        </div>
        <div className={`view${view === "Insights" ? " active" : ""}`}>
          <InsightsView />
        </div>
        <div className={`view${view === "More" ? " active" : ""}`}>
          <MoreView />
        </div>
      </main>

      <BottomNav />
      <Toast />
      <ModalHost />
      <NotificationBanner />
    </div>
  );
}
