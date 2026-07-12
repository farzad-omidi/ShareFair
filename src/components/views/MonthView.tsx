"use client";

import { useMemo, useState } from "react";
import { useSpace } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useLanguage } from "@/lib/i18n/context";
import { calcMonth, monthName } from "@/lib/domain";
import { money } from "@/lib/format";
import { memberVars } from "@/lib/palettes";
import { MemberAvatar } from "@/components/Avatar";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import type { EntryRow } from "@/lib/types";
import { IconSwap, IconUndo, IconReceipt, IconClock } from "@/components/icons";

export function MonthView() {
  const { entries, members, categories, selectedMonth, activeSpace } = useSpace();
  const { openModal } = useUI();
  const { t } = useLanguage();
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
        .filter((e) => e.month === selectedMonth && e.kind !== "request")
        .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at)),
    [entries, selectedMonth]
  );

  return (
    <>
      <div className="card">
        <div className="card-title">
          <div>
            <h2>{t("month_card_title")}</h2>
            <p>
              {monthName(selectedMonth)}
              {filterHousing ? ` · ${t("month_housing_excluded")}` : ""}
            </p>
          </div>
          <button className="link" onClick={() => setFilterHousing((f) => !f)}>
            {filterHousing ? t("month_filter_no_housing") : t("month_filter_all")}
          </button>
        </div>
        <div className="metric-grid">
          <div className="metric wide">
            <span>{t("metric_total_shared")}</span>
            <strong>
              <AnimatedMoney value={summary.total} currency={activeSpace?.currency} />
            </strong>
            <small>{filterHousing ? t("metric_total_note_excl") : t("metric_total_note_all")}</small>
          </div>
          {members.map((m) => (
            <div className="metric member-metric" style={memberVars(m.palette)} key={m.id}>
              <span>{t("metric_paid_by", { name: m.display_name })}</span>
              <strong>
                <AnimatedMoney value={summary.paid[m.user_id] || 0} currency={activeSpace?.currency} />
              </strong>
              <small>{t("metric_fair_share", { amount: money(fair, activeSpace?.currency) })}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>{t("entries_card_title")}</h2>
            <p>{t("entries_card_subtitle")}</p>
          </div>
        </div>
        <div className="entry-list">
          {list.length === 0 ? (
            <div className="empty">{t("entries_empty", { month: monthName(selectedMonth) })}</div>
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
  const { t } = useLanguage();

  if (e.kind === "settlement") {
    const from = members.find((m) => m.user_id === e.from_id);
    const to = members.find((m) => m.user_id === e.to_id);
    const pending = e.status === "pending";
    return (
      <button className="entry" onClick={onClick}>
        <span className="entry-ico settle">
          {pending ? <IconClock width={16} height={16} /> : <IconSwap width={16} height={16} />}
        </span>
        <span>
          <strong>
            {t(pending ? "entry_settling" : "entry_settled", {
              from: from?.display_name ?? "Someone",
              to: to?.display_name ?? "someone",
            })}
          </strong>
          <small>
            {e.entry_date} · {t(pending ? "entry_awaiting" : "entry_payment")}
          </small>
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
        {e.kind === "credit" ? <IconUndo width={16} height={16} /> : <IconReceipt width={16} height={16} />}
      </span>
      <span>
        <strong>{cat?.name ?? "Other"}</strong>
        <small>
          <span className="member-name-line" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <MemberAvatar member={payer} size={15} maxLetters={1} />
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
