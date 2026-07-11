"use client";

import { useMemo, useState } from "react";
import { useSpace } from "@/lib/store";
import { calcMonth, isHousing, monthName, round, signed } from "@/lib/domain";
import { AnimatedMoney } from "@/components/AnimatedMoney";

export function InsightsView() {
  const { entries, members, categories, selectedMonth, activeSpace } = useSpace();
  const [mode, setMode] = useState<"including" | "excluding">("including");
  const excludeHousing = mode === "excluding";

  const catsById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);

  const months = useMemo(
    () =>
      [...new Set(entries.filter((e) => e.kind !== "settlement").map((e) => e.month))].sort(),
    [entries]
  );
  const count = months.length || 1;

  const { total, paid, byCat } = useMemo(() => {
    let total = 0;
    const paid: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
    const byCat: Record<string, { total: number; count: number }> = {};
    entries
      .filter((e) => e.kind !== "settlement")
      .forEach((e) => {
        if (excludeHousing && isHousing(e, catsById)) return;
        const a = signed(e);
        total += a;
        if (e.payer_id) paid[e.payer_id] = (paid[e.payer_id] || 0) + a;
        const cn = (e.category_id ? catsById.get(e.category_id)?.name : undefined) || "Other";
        byCat[cn] = byCat[cn] || { total: 0, count: 0 };
        byCat[cn].total += a;
        byCat[cn].count++;
      });
    return { total: round(total), paid, byCat };
  }, [entries, excludeHousing, catsById, memberIds]);

  const totals = useMemo(
    () => months.map((m) => ({ m, total: calcMonth(entries, memberIds, catsById, m, { excludeHousing }).total })),
    [months, entries, memberIds, catsById, excludeHousing]
  );
  const max = Math.max(1, ...totals.map((x) => Math.abs(x.total)));
  const recent = totals.slice(-8);

  const catEntries = Object.entries(byCat).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));

  return (
    <>
      <div className="card">
        <div className="card-title">
          <div>
            <h2>Your rhythm</h2>
            <p>Average spending without turning life into a spreadsheet.</p>
          </div>
        </div>
        <div className="segment">
          <button className={mode === "including" ? "active" : ""} onClick={() => setMode("including")}>
            Including housing
          </button>
          <button className={mode === "excluding" ? "active" : ""} onClick={() => setMode("excluding")}>
            Excluding housing
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          {recent.length === 0 ? (
            <div className="empty">Add a few months to see your rhythm.</div>
          ) : (
            <div className="chart-bars">
              {recent.map((x) => (
                <div className={`chart-col${x.m === selectedMonth ? " current" : ""}`} key={x.m}>
                  <span className="val">{Math.round(x.total)}</span>
                  <div className="chart-track">
                    <div className="bar" style={{ height: `${Math.max(3, (Math.abs(x.total) / max) * 100)}%` }}></div>
                  </div>
                  <small>{monthName(x.m, true)}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Averages</h2>
        </div>
        <div className="metric-grid">
          <div className="metric wide">
            <span>Average month</span>
            <strong>
              <AnimatedMoney value={total / count} currency={activeSpace?.currency} />
            </strong>
            <small>
              {excludeHousing ? "Housing excluded" : "Housing included"} · based on {count} month
              {count === 1 ? "" : "s"}
            </small>
          </div>
          <div className="metric">
            <span>Average per person</span>
            <strong>
              <AnimatedMoney value={total / count / (members.length || 1)} currency={activeSpace?.currency} />
            </strong>
          </div>
          {members.slice(0, 3).map((m) => (
            <div className="metric" key={m.id}>
              <span>{m.display_name} paid avg.</span>
              <strong>
                <AnimatedMoney value={(paid[m.user_id] || 0) / count} currency={activeSpace?.currency} />
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>By category</h2>
        </div>
        {catEntries.length === 0 ? (
          <div className="empty">No category data yet.</div>
        ) : (
          catEntries.map(([name, d]) => (
            <div className="row" key={name}>
              <div>
                <strong>{name}</strong>
                <small>{d.count} entries · average per month</small>
              </div>
              <strong>
                <AnimatedMoney value={d.total / count} currency={activeSpace?.currency} />
              </strong>
            </div>
          ))
        )}
      </div>
    </>
  );
}
