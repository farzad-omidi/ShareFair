"use client";

import { SpaceProvider, useSpace } from "@/lib/store";
import { UIProvider, useUI } from "@/lib/ui";
import { monthName } from "@/lib/domain";
import { Onboarding } from "@/components/Onboarding";
import { BottomNav } from "@/components/BottomNav";
import { Toast } from "@/components/Toast";
import { ModalHost } from "@/components/ModalHost";
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
  const { loading, activeSpace, spaces, members, selectedMonth, realtimeStatus } = useSpace();
  const { view, openModal } = useUI();

  if (loading) {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!activeSpace || spaces.length === 0) {
    return <Onboarding />;
  }

  return (
    <>
      <div className="glow" />
      <main className="app-shell">
        <header className="app-header">
          <div>
            <div className="eyebrow">
              {members.length} people · {activeSpace.currency}
            </div>
            <h1 className="brand">{activeSpace.name}</h1>
          </div>
          <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
            <button className="pill" onClick={() => openModal({ type: "month" })}>
              <span>{monthName(selectedMonth, true)}</span>
              <small>⌄</small>
            </button>
            <span className={`status ${realtimeStatus === "live" ? "green" : "neutral"}`}>
              <span className="s-dot"></span>
              <span>{realtimeStatus === "live" ? "Live" : realtimeStatus === "connecting" ? "Connecting" : "Offline"}</span>
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
    </>
  );
}
