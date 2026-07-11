"use client";

import { useMemo, useState } from "react";
import { useSpace } from "@/lib/store";
import { calcThrough, simplify, monthName } from "@/lib/domain";
import { memberVars } from "@/lib/palettes";
import { MemberAvatar } from "@/components/Avatar";
import { AnimatedMoney } from "@/components/AnimatedMoney";

const SETTLE_EXIT_MS = 340;

export function SettleView() {
  const { entries, members, categories, selectedMonth, activeSpace, settle, showToast } = useSpace();
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
            <p>Open balances include earlier unpaid months until marked as settled.</p>
          </div>
        </div>
        {debts.length === 0 ? (
          <div className="empty">Everything is settled through {monthName(selectedMonth)}.</div>
        ) : (
          debts.map((d) => {
            const key = `${d.fromId}-${d.toId}`;
            const settling = settlingKey === key;
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
                  <div className="amt">
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
                    {settling ? "Settling…" : "Mark as settled"}
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
            <p>A transparent running balance for this shared space.</p>
          </div>
        </div>
        <div className="detail-grid">
          {members.map((m) => (
            <div className="smallbox member-box" style={memberVars(m.palette)} key={m.id}>
              <span>{m.display_name}</span>
              <strong>
                <AnimatedMoney value={balances[m.user_id] || 0} currency={activeSpace?.currency} />
              </strong>
            </div>
          ))}
        </div>
        <p className="mini" style={{ lineHeight: 1.5, marginTop: 10 }}>
          Positive means this person has paid more than their share and should receive. Negative means
          this person should settle with someone else.
        </p>
      </div>
    </>
  );
}
