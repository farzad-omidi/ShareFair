"use client";

import { useMemo, useState } from "react";
import { useSpace } from "@/lib/store";
import { useLanguage } from "@/lib/i18n/context";
import {
  addDays,
  addMonths,
  addYears,
  calcByPeriod,
  monthName,
  round,
  signed,
  today,
  weekStart,
  type PeriodTotal,
} from "@/lib/domain";
import { money, moneyCompact } from "@/lib/format";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import { categoryPaletteFor } from "@/lib/palettes";
import type { EntryRow } from "@/lib/types";

type Granularity = "day" | "week" | "month" | "year";
const GRANULARITIES: Granularity[] = ["day", "week", "month", "year"];

function monthInitial(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "narrow" });
}

function weekdayInitial(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });
}

function dayOfMonth(dateStr: string): string {
  return String(new Date(`${dateStr}T00:00:00`).getDate());
}

function formatDateRange(startStr: string, endStr: string): string {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, { day: "numeric", month: sameMonth ? undefined : "short" });
  const endLabel = end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

// "Nice" evenly-spaced round-number tick values for the y-axis (0, 25, 50, 75,
// 100-style), derived from whatever the tallest bar actually is rather than a
// fixed scale.
function niceTicks(max: number, targetCount = 4): number[] {
  if (max <= 0) return [0];
  const rawStep = max / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  const niceResidual = residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1;
  const step = niceResidual * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

type PeriodPlan = {
  periodOf: (e: EntryRow) => string;
  keys: string[];
  label: (key: string) => string;
  isCurrent: (key: string) => boolean;
  navLabel: string;
  canNavigate: boolean;
  prevAnchor: string;
  nextAnchor: string;
};

function buildPeriodPlan(granularity: Granularity, anchor: string, entries: EntryRow[]): PeriodPlan {
  const todayStr = today();

  if (granularity === "day") {
    const start = weekStart(anchor);
    const keys = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return {
      periodOf: (e) => e.entry_date,
      keys,
      label: weekdayInitial,
      isCurrent: (k) => k === todayStr,
      navLabel: formatDateRange(start, addDays(start, 6)),
      canNavigate: true,
      prevAnchor: addDays(anchor, -7),
      nextAnchor: addDays(anchor, 7),
    };
  }

  if (granularity === "week") {
    const [y, m] = anchor.slice(0, 7).split("-").map(Number);
    const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
    const keys: string[] = [];
    for (let cur = weekStart(monthStart); cur <= monthEnd; cur = addDays(cur, 7)) keys.push(cur);
    const curWeekStart = weekStart(todayStr);
    return {
      periodOf: (e) => weekStart(e.entry_date),
      keys,
      label: dayOfMonth,
      isCurrent: (k) => k === curWeekStart,
      navLabel: monthName(anchor.slice(0, 7)),
      canNavigate: true,
      prevAnchor: addMonths(anchor, -1),
      nextAnchor: addMonths(anchor, 1),
    };
  }

  if (granularity === "month") {
    const y = anchor.slice(0, 4);
    const keys = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
    return {
      periodOf: (e) => e.month,
      keys,
      label: monthInitial,
      isCurrent: (k) => k === todayStr.slice(0, 7),
      navLabel: y,
      canNavigate: true,
      prevAnchor: addYears(anchor, -1),
      nextAnchor: addYears(anchor, 1),
    };
  }

  // year
  const presentYears = [
    ...new Set(
      entries.filter((e) => e.kind !== "settlement" && e.kind !== "request").map((e) => e.month.slice(0, 4))
    ),
  ].sort();
  const keys = presentYears.length ? presentYears : [anchor.slice(0, 4)];
  return {
    periodOf: (e) => e.month.slice(0, 4),
    keys,
    label: (k) => k,
    isCurrent: (k) => k === todayStr.slice(0, 4),
    navLabel: "",
    canNavigate: false,
    prevAnchor: anchor,
    nextAnchor: anchor,
  };
}

type ChartSegment = "housing" | "other";

export function InsightsView() {
  const { entries, members, categories, activeSpace } = useSpace();
  const { t } = useLanguage();
  const [granularity, setGranularity] = useState<Granularity>("month");
  const [anchor, setAnchor] = useState(today());
  // Which stacked-bar segments are toggled off -- clicking a legend chip
  // excludes that category from every bar (the total, the bar height, and
  // the y-axis scale all recompute around what's left), the same "exclude
  // housing" idea Month view's own filter already applies to its total.
  const [hiddenSegments, setHiddenSegments] = useState<Set<ChartSegment>>(new Set());
  const toggleSegment = (seg: ChartSegment) =>
    setHiddenSegments((prev) => {
      const next = new Set(prev);
      if (next.has(seg)) next.delete(seg);
      else next.add(seg);
      return next;
    });

  const catsById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);

  const months = useMemo(
    () =>
      [...new Set(entries.filter((e) => e.kind !== "settlement" && e.kind !== "request").map((e) => e.month))].sort(),
    [entries]
  );
  const count = months.length || 1;

  const { total, paid, byCat } = useMemo(() => {
    let total = 0;
    const paid: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
    const byCat: Record<string, { total: number; count: number }> = {};
    entries
      .filter((e) => e.kind !== "settlement" && e.kind !== "request")
      .forEach((e) => {
        const a = signed(e);
        total += a;
        if (e.payer_id) paid[e.payer_id] = (paid[e.payer_id] || 0) + a;
        const cn = (e.category_id ? catsById.get(e.category_id)?.name : undefined) || t("fallback_other");
        byCat[cn] = byCat[cn] || { total: 0, count: 0 };
        byCat[cn].total += a;
        byCat[cn].count++;
      });
    return { total: round(total), paid, byCat };
  }, [entries, catsById, memberIds, t]);
  const catEntries = Object.entries(byCat).sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total));

  const plan = useMemo(() => buildPeriodPlan(granularity, anchor, entries), [granularity, anchor, entries]);
  const byPeriod = useMemo(() => calcByPeriod(entries, catsById, plan.periodOf), [entries, catsById, plan]);
  const hasAnyData = plan.keys.some((k) => byPeriod[k] && Math.abs(byPeriod[k].total) > 0.005);
  // A hidden segment doesn't just dim -- it's subtracted out of the total,
  // the bar height, and (via maxTotal below) the y-axis scale, so toggling
  // "Rent" off actually shows what's left, not a visually-faded version of
  // the same unchanged number.
  const visibleTotal = (k: string): number => {
    const d = byPeriod[k] || { total: 0, housing: 0, other: 0 };
    const housing = hiddenSegments.has("housing") ? 0 : d.housing;
    const other = hiddenSegments.has("other") ? 0 : d.other;
    return round(housing + other);
  };
  const maxTotal = Math.max(1, ...plan.keys.map((k) => Math.abs(visibleTotal(k))));
  const ticks = niceTicks(maxTotal);
  const maxTick = ticks[ticks.length - 1] || 1;

  return (
    <>
      <div className="card">
        <div className="card-title">
          <div>
            <h2>{t("rhythm_card_title")}</h2>
            <p>{t("rhythm_card_subtitle")}</p>
          </div>
        </div>

        <div className="segment segment-4">
          {GRANULARITIES.map((g) => (
            <button key={g} className={granularity === g ? "active" : ""} onClick={() => setGranularity(g)}>
              {t(`rhythm_tab_${g}`)}
            </button>
          ))}
        </div>

        {plan.canNavigate && (
          <div className="rhythm-nav" dir="ltr">
            <button
              type="button"
              className="ghost rhythm-nav-btn"
              aria-label={t("rhythm_nav_prev")}
              onClick={() => setAnchor(plan.prevAnchor)}
            >
              ‹
            </button>
            <strong>{plan.navLabel}</strong>
            <button
              type="button"
              className="ghost rhythm-nav-btn"
              aria-label={t("rhythm_nav_next")}
              onClick={() => setAnchor(plan.nextAnchor)}
            >
              ›
            </button>
          </div>
        )}

        {!hasAnyData ? (
          <div className="empty" style={{ marginTop: 12 }}>
            {t("rhythm_empty")}
          </div>
        ) : (
          <div className="chart-wrap" dir="ltr" style={{ marginTop: 12 }}>
            <div className="chart-y-axis">
              {ticks
                .slice()
                .reverse()
                .map((v) => (
                  <span key={v}>{money(v, activeSpace?.currency)}</span>
                ))}
            </div>
            <div
              className="chart-bars"
              style={{
                backgroundImage:
                  ticks.length > 1
                    ? `repeating-linear-gradient(to top, var(--line) 0, var(--line) 1px, transparent 1px, transparent ${112 / (ticks.length - 1)}px)`
                    : "none",
              }}
            >
              {plan.keys.map((k) => {
                const d: PeriodTotal = byPeriod[k] || { total: 0, housing: 0, other: 0 };
                const housingVal = hiddenSegments.has("housing") ? 0 : d.housing;
                const otherVal = hiddenSegments.has("other") ? 0 : d.other;
                const periodTotal = round(housingVal + otherVal);
                const isCurrent = plan.isCurrent(k);
                return (
                  <div className={`chart-col${isCurrent ? " current" : ""}`} key={k}>
                    <span className="val">{isCurrent ? moneyCompact(periodTotal, activeSpace?.currency) : " "}</span>
                    <div className="chart-track">
                      <div className="bar" style={{ height: `${Math.max(3, (Math.abs(periodTotal) / maxTick) * 100)}%` }}>
                        {!hiddenSegments.has("other") && (
                          <div className="bar-segment" style={{ flexGrow: Math.abs(otherVal) }} />
                        )}
                        {!hiddenSegments.has("housing") && (
                          <div className="bar-segment housing" style={{ flexGrow: Math.abs(housingVal) }} />
                        )}
                      </div>
                    </div>
                    <small>{plan.label(k)}</small>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="chips" style={{ marginTop: 12 }}>
          <button
            type="button"
            className={`chip rhythm-legend${hiddenSegments.has("other") ? "" : " active"}`}
            aria-pressed={!hiddenSegments.has("other")}
            onClick={() => toggleSegment("other")}
          >
            <span className="rhythm-legend-dot" /> {t("fallback_other")}
          </button>
          <button
            type="button"
            className={`chip rhythm-legend${hiddenSegments.has("housing") ? "" : " active"}`}
            aria-pressed={!hiddenSegments.has("housing")}
            onClick={() => toggleSegment("housing")}
          >
            <span className="rhythm-legend-dot housing" /> {t("category_group_housing")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>{t("averages_card_title")}</h2>
        </div>
        <div className="metric-grid">
          <div className="metric wide">
            <span>{t("metric_average_month")}</span>
            <strong>
              <AnimatedMoney value={total / count} currency={activeSpace?.currency} />
            </strong>
            <small>{t("metric_months_count", { count })}</small>
          </div>
          <div className="metric">
            <span>{t("metric_average_per_person")}</span>
            <strong>
              <AnimatedMoney value={total / count / (members.length || 1)} currency={activeSpace?.currency} />
            </strong>
          </div>
          {members.slice(0, 3).map((m) => (
            <div className="metric" key={m.id}>
              <span>{t("metric_member_avg", { name: m.display_name })}</span>
              <strong>
                <AnimatedMoney value={(paid[m.user_id] || 0) / count} currency={activeSpace?.currency} />
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>{t("bycategory_card_title")}</h2>
        </div>
        {catEntries.length === 0 ? (
          <div className="empty">{t("bycategory_empty")}</div>
        ) : (
          catEntries.map(([name, d]) => (
            <div className="row" key={name}>
              <div className="member-name-line" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: categoryPaletteFor(name).accent,
                    flex: "none",
                  }}
                />
                <div>
                  <strong>{name}</strong>
                  <small>{t("bycategory_entries_note", { count: d.count })}</small>
                </div>
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
