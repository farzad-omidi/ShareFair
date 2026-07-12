"use client";

import { useMemo, useState } from "react";
import { useSpace } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { calcThrough, simplify, monthName } from "@/lib/domain";
import { MemberAvatar } from "@/components/Avatar";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import { IconCheck, IconClock, IconX, IconBell } from "@/components/icons";

const SETTLE_EXIT_MS = 340;
const EPSILON = 0.005;

// Direction is shown with a consistent green (owed to them) / warm terracotta
// (they owe) regardless of who's involved — the same convention every
// payment app already uses, so it reads instantly without having to
// remember whose identity color means what. Member colors stay reserved
// for avatars, where "who" — not "which way" — is the question.
function balanceColor(v: number): string | undefined {
  if (v > EPSILON) return "var(--green)";
  if (v < -EPSILON) return "var(--accent-dark)";
  return undefined;
}

export function SettleView() {
  const {
    entries,
    members,
    categories,
    selectedMonth,
    activeSpace,
    profile,
    settle,
    confirmSettlement,
    declineSettlement,
    requestPayment,
    cancelRequest,
    showToast,
  } = useSpace();
  const { openModal } = useUI();
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const catsById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);

  const balances = useMemo(
    () => calcThrough(entries, memberIds, catsById, selectedMonth),
    [entries, memberIds, catsById, selectedMonth]
  );
  const debts = useMemo(() => simplify(balances), [balances]);
  const pendingByPair = useMemo(() => {
    const map = new Map<string, (typeof entries)[number]>();
    entries
      .filter((e) => e.kind === "settlement" && e.status === "pending")
      .forEach((e) => map.set(`${e.from_id}-${e.to_id}`, e));
    return map;
  }, [entries]);
  const requestByPair = useMemo(() => {
    const map = new Map<string, (typeof entries)[number]>();
    entries.filter((e) => e.kind === "request").forEach((e) => map.set(`${e.from_id}-${e.to_id}`, e));
    return map;
  }, [entries]);

  function memberFor(userId: string) {
    return members.find((m) => m.user_id === userId);
  }
  function nameFor(userId: string) {
    return memberFor(userId)?.display_name ?? "Someone";
  }

  async function handleSettle(key: string, fromId: string, toId: string, amount: number) {
    // Show the resolution instantly rather than a vague "in progress" spinner —
    // the peak-end moment is the confirmation, not the wait — then let the row
    // animate out before the underlying data actually reloads.
    setSettlingKey(key);
    await new Promise((resolve) => setTimeout(resolve, SETTLE_EXIT_MS));
    await settle(fromId, toId, amount);
    setSettlingKey(null);
  }

  async function handleConfirm(id: string) {
    setBusyId(id);
    await confirmSettlement(id);
    setBusyId(null);
    // Confirming is the actual payoff moment -- the debt is really gone, not just
    // claimed. Trial-and-buy timing isn't decided yet; this just previews how
    // showing the unlock screen right here would feel.
    openModal({ type: "unlock" });
  }

  async function handleDecline(id: string) {
    setBusyId(id);
    await declineSettlement(id);
    setBusyId(null);
  }

  async function handleRequest(key: string, fromId: string, toId: string, amount: number) {
    setBusyId(`req-${key}`);
    await requestPayment(fromId, toId, amount);
    setBusyId(null);
  }

  async function handleCancelRequest(id: string) {
    setBusyId(id);
    await cancelRequest(id);
    setBusyId(null);
  }

  return (
    <>
      <div className="card">
        <div className="card-title">
          <div>
            <h2>Settle gently</h2>
            <p>Balances carry over from earlier months until you settle them.</p>
          </div>
        </div>
        {debts.length === 0 ? (
          <div className="empty">Everything is settled through {monthName(selectedMonth)}.</div>
        ) : (
          debts.map((d) => {
            const key = `${d.fromId}-${d.toId}`;
            const settling = settlingKey === key;
            // Only color the amount for the viewer's own stake in this specific
            // debt — if it doesn't involve them, it stays neutral rather than
            // implying a direction that isn't theirs.
            const amtColor =
              profile?.id === d.toId ? "var(--green)" : profile?.id === d.fromId ? "var(--accent-dark)" : undefined;
            return (
              <div className={`debt-row${settling ? " settling" : ""}`} key={key}>
                <div className="top">
                  <div>
                    <strong style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <MemberAvatar member={memberFor(d.fromId)} size={20} maxLetters={1} />
                      {nameFor(d.fromId)} →{" "}
                      <MemberAvatar member={memberFor(d.toId)} size={20} maxLetters={1} />
                      {nameFor(d.toId)}
                    </strong>
                    <small className="mini">Open through {monthName(selectedMonth)}</small>
                  </div>
                  <div className="amt" style={amtColor ? { color: amtColor } : undefined}>
                    <AnimatedMoney value={d.amount} currency={activeSpace?.currency} />
                  </div>
                </div>
                {(() => {
                  const pending = pendingByPair.get(key);
                  if (pending) {
                    const busy = busyId === pending.id;
                    const iAmConfirmer =
                      profile?.id !== pending.created_by && (profile?.id === d.fromId || profile?.id === d.toId);
                    if (iAmConfirmer) {
                      return (
                        <>
                          <p className="mini pending-note">
                            <IconClock width={13} height={13} />{" "}
                            {`${nameFor(pending.created_by)} says this is settled — confirm it's right.`}
                          </p>
                          <div className="grid2">
                            <button className="ghost" disabled={busy} onClick={() => handleDecline(pending.id)}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <IconX width={15} height={15} /> Decline
                              </span>
                            </button>
                            <button className="primary green" disabled={busy} onClick={() => handleConfirm(pending.id)}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <IconCheck width={16} height={16} /> Confirm
                              </span>
                            </button>
                          </div>
                        </>
                      );
                    }
                    const counterparty =
                      pending.created_by === d.fromId ? d.toId : pending.created_by === d.toId ? d.fromId : null;
                    return (
                      <>
                        <p className="mini pending-note">
                          <IconClock width={13} height={13} />{" "}
                          {counterparty ? `Waiting for ${nameFor(counterparty)} to confirm.` : "Waiting for confirmation."}
                        </p>
                        {profile?.id === pending.created_by && (
                          <button className="ghost" disabled={busy} onClick={() => handleDecline(pending.id)}>
                            Cancel request
                          </button>
                        )}
                      </>
                    );
                  }
                  const normalActions = (
                    <div className="grid2">
                      <button
                        className="ghost"
                        disabled={settling}
                        onClick={() => {
                          navigator.clipboard?.writeText(String(d.amount)).catch(() => {});
                          showToast("Amount copied");
                        }}
                      >
                        Copy amount
                      </button>
                      <button
                        className="primary green"
                        disabled={settling}
                        onClick={() => handleSettle(key, d.fromId, d.toId, d.amount)}
                      >
                        {settling ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <IconCheck width={16} height={16} /> Sent
                          </span>
                        ) : (
                          "Mark as settled"
                        )}
                      </button>
                    </div>
                  );

                  const request = requestByPair.get(key);
                  if (request) {
                    const busy = busyId === request.id;
                    if (profile?.id === request.created_by) {
                      return (
                        <>
                          <p className="mini pending-note">
                            <IconBell width={13} height={13} />{" "}
                            {`Waiting for ${nameFor(d.fromId)} to pay.`}
                          </p>
                          <button className="ghost" disabled={busy} onClick={() => handleCancelRequest(request.id)}>
                            Cancel request
                          </button>
                        </>
                      );
                    }
                    return (
                      <>
                        <p className="mini pending-note">
                          <IconBell width={13} height={13} />{" "}
                          {`${nameFor(request.to_id ?? "")} requested this payment.`}
                        </p>
                        {normalActions}
                      </>
                    );
                  }

                  const requesting = busyId === `req-${key}`;
                  return (
                    <>
                      {normalActions}
                      {profile?.id === d.toId && (
                        <button
                          className="link"
                          style={{ marginTop: 8, display: "block", width: "100%", textAlign: "center" }}
                          disabled={requesting}
                          onClick={() => handleRequest(key, d.fromId, d.toId, d.amount)}
                        >
                          {requesting ? "Sending…" : "Or request payment instead"}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>Why this amount?</h2>
            <p>See exactly how each person&apos;s balance adds up.</p>
          </div>
        </div>
        <div className="detail-grid">
          {members.map((m) => {
            const bal = balances[m.user_id] || 0;
            return (
              <div className="smallbox" key={m.id}>
                <span>
                  <MemberAvatar member={m} size={14} maxLetters={1} />
                  <span className="name-text">{m.display_name}</span>
                </span>
                <strong style={{ color: balanceColor(bal) }}>
                  <AnimatedMoney value={bal} currency={activeSpace?.currency} />
                </strong>
              </div>
            );
          })}
        </div>
        <p className="mini" style={{ lineHeight: 1.5, marginTop: 10 }}>
          Green means they&apos;re owed money. Terracotta means they owe.
        </p>
      </div>
    </>
  );
}
