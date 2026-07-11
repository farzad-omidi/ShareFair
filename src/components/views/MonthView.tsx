"use client";

import { useMemo, useState } from "react";
import { useSpace } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { calcMonth, monthName } from "@/lib/domain";
import { money } from "@/lib/format";
import { memberVars } from "@/lib/palettes";
import type { EntryRow } from "@/lib/types";

export function MonthView() {
  const { entries, members, categories, selectedMonth, activeSpace } = useSpace();
  const { openModal } = useUI();
  const [filterHousing, setFilterHousing] = useState(false);

  const catsById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);

  const summary = useMemo(
    () => calcMonth(entries, memberIds, catsById, selectedMonth, { excludeHousing: filterHousing }),
    [entries, memberIds, catsById, selectedMonth, filterHousing]
  );

  const fair = summary.total / (members.length || 1);

  const list = useMemo(
    () =>
      entries
        .filter((e) => e.month === selectedMonth)
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at)),
    [entries, selectedMonth]
  );

  return (
    <>
      <div className="card">
        <div className="card-title">
          <div>
            <h2>Month overview</h2>
            <p>
              {monthName(selectedMonth)}
              {filterHousing ? " · excluding housing" : ""}
            </p>
          </div>
          <button className="link" onClick={() => setFilterHousing((f) => !f)}>
            {filterHousing ? "No housing" : "All"}
          </button>
        </div>
        <div className="metric-grid">
          <div className="metric wide">
            <span>Total shared</span>
            <strong>{money(summary.total, activeSpace?.currency)}</strong>
            <small>{filterHousing ? "Housing categories hidden" : "All categories included"}</small>
          </div>
          {members.map((m) => (
            <div className="metric member-metric" style={memberVars(m.palette)} key={m.id}>
              <span>Paid by {m.display_name}</span>
              <strong>{money(summary.paid[m.user_id] || 0, activeSpace?.currency)}</strong>
              <small>Fair share: {money(fair, activeSpace?.currency)}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>Entries</h2>
            <p>Tap an entry to edit it.</p>
          </div>
        </div>
        <div className="entry-list">
          {list.length === 0 ? (
            <div className="empty">No entries for {monthName(selectedMonth)} yet.</div>
          ) : (
            list.map((e) => (
              <EntryItem
                key={e.id}
                entry={e}
                onClick={() => openModal({ type: "editEntry", entryId: e.id })}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function EntryItem({ entry: e, onClick }: { entry: EntryRow; onClick: () => void }) {
  const { members, categories, activeSpace } = useSpace();

  if (e.kind === "settlement") {
    const from = members.find((m) => m.user_id === e.from_id);
    const to = members.find((m) => m.user_id === e.to_id);
    return (
      <button className="entry" onClick={onClick}>
        <span className="entry-ico settle">↔</span>
        <span>
          <strong>
            {from?.display_name ?? "Someone"} settled with {to?.display_name ?? "someone"}
          </strong>
          <small>{e.entry_date} · payment</small>
        </span>
        <span className="entry-amount settle">{money(e.amount, activeSpace?.currency)}</span>
      </button>
    );
  }

  const payer = members.find((m) => m.user_id === e.payer_id);
  const cat = categories.find((c) => c.id === e.category_id);

  return (
    <button className="entry" onClick={onClick}>
      <span className="entry-ico member" style={memberVars(payer?.palette)}>
        {e.kind === "credit" ? "↩" : "•"}
      </span>
      <span>
        <strong>{cat?.name ?? "Other"}</strong>
        <small>
          <span className="member-name-line" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="mini-dot" style={memberVars(payer?.palette)}></span>
            {payer?.display_name ?? "Someone"}
          </span>{" "}
          · {e.entry_date}
          {e.note ? ` · ${e.note}` : ""}
        </small>
      </span>
      <span className={`entry-amount${e.kind === "credit" ? " credit" : ""}`}>
        {e.kind === "credit" ? "-" : ""}
        {money(e.amount, activeSpace?.currency)}
      </span>
    </button>
  );
}
