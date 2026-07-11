"use client";

import { useMemo, useState } from "react";
import { useSpace } from "@/lib/store";
import { calcThrough, simplify, monthName } from "@/lib/domain";
import { MemberAvatar } from "@/components/Avatar";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import { IconCheck } from "@/components/icons";

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
  const { entries, members, categories, selectedMonth, activeSpace, profile, settle, showToast } = useSpace();
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const catsById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);

  const balances = useMemo(
    () => calcThrough(entries, memberIds, catsById, selectedMonth),
    [entries, memberIds, catsById, selectedMonth]
  );
  const debts = useMemo(() => simplify(balances), [balances]);

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
                        <IconCheck width={16} height={16} /> Settled
                      </span>
                    ) : (
                      "Mark as settled"
                    )}
                  </button>
                </div>
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
