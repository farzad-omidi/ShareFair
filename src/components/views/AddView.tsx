"use client";

import { useMemo, useState } from "react";
import { useSpace } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useLanguage } from "@/lib/i18n/context";
import { today, calcThrough, simplify, monthName } from "@/lib/domain";
import { money, symbol, parseAmount } from "@/lib/format";
import { memberVars, paletteFor } from "@/lib/palettes";
import { MemberAvatar } from "@/components/Avatar";
import { AnimatedMoney } from "@/components/AnimatedMoney";
import { IconCheck } from "@/components/icons";
import type { SplitType } from "@/lib/types";

export function AddView() {
  const {
    members,
    categories,
    profile,
    activeSpace,
    activeSpaceId,
    spaces,
    switchSpace,
    addEntry,
    selectedMonth,
    entries,
    showToast,
  } = useSpace();
  const { openModal } = useUI();
  const { t } = useLanguage();

  const myMember = members.find((m) => m.user_id === profile?.id) ?? members[0];

  const [payerIdOverride, setPayerIdOverride] = useState<string | null>(null);
  const [kind, setKind] = useState<"expense" | "credit">("expense");
  const [categoryIdOverride, setCategoryIdOverride] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [repeat, setRepeat] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitMethod, setSplitMethod] = useState<SplitType>("equal");
  const [participantIdsOverride, setParticipantIdsOverride] = useState<Set<string> | null>(null);
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const activeCategories = categories.filter((c) => c.active);

  // Derived defaults: fall back to sensible values until the user makes an explicit choice,
  // rather than syncing state from props in an effect.
  const payerId = payerIdOverride && members.some((m) => m.user_id === payerIdOverride)
    ? payerIdOverride
    : myMember?.user_id ?? "";
  const categoryId = categoryIdOverride && categories.some((c) => c.id === categoryIdOverride)
    ? categoryIdOverride
    : activeCategories[0]?.id ?? "";
  const participantIds = participantIdsOverride ?? new Set(members.map((m) => m.user_id));

  const payer = members.find((m) => m.user_id === payerId);
  const payerPalette = payer?.palette ?? 0;

  function toggleParticipant(id: string) {
    const next = new Set(participantIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setParticipantIdsOverride(next);
  }

  async function handleSubmit() {
    if (submitting) return;
    const a = parseAmount(amount);
    if (!Number.isFinite(a) || a <= 0) return;
    const values: Record<string, number> = {};
    Object.entries(splitValues).forEach(([id, v]) => {
      const n = parseAmount(v);
      if (Number.isFinite(n) && n > 0) values[id] = n;
    });
    if (splitMethod === "amounts") {
      const sum = Object.values(values).reduce((s, v) => s + v, 0);
      if (sum > a + 0.005) {
        showToast(t("add_toast_amounts_over"));
        return;
      }
      const allEntered = [...participantIds].every((id) => Object.prototype.hasOwnProperty.call(values, id));
      if (allEntered && sum < a - 0.005) {
        showToast(t("add_toast_amounts_under"));
        return;
      }
    }
    setSubmitting(true);
    try {
      await addEntry({
        kind,
        payerId,
        categoryId,
        amount: Math.round(a * 100) / 100,
        date,
        note: note.trim(),
        participantIds: [...participantIds],
        splitType: splitMethod,
        splitValues: values,
        recurring: repeat,
      });
      setAmount("");
      setNote("");
    } finally {
      setSubmitting(false);
    }
  }

  const debts = useMemo(() => {
    const catsById = new Map(categories.map((c) => [c.id, c]));
    return simplify(calcThrough(entries, members.map((m) => m.user_id), catsById, selectedMonth));
  }, [entries, members, categories, selectedMonth]);

  const splitLabel = splitMethod === "percent" ? "%" : splitMethod === "shares" ? t("add_split_shares_unit") : symbol(activeSpace?.currency || "EUR");

  return (
    <>
      {spaces.length > 1 && (
        <div className="chips space-tabs">
          {spaces.map((s) => (
            <button
              key={s.id}
              className={`chip${s.id === activeSpaceId ? " active" : ""}`}
              onClick={() => s.id !== activeSpaceId && switchSpace(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <div>
            <h2>{t("add_card_title")}</h2>
            <p>{t("add_card_subtitle")}</p>
          </div>
          <button className="link" onClick={() => setDate(today())}>
            {t("add_today_btn")}
          </button>
        </div>

        <div className="grid2">
          {members.map((m) => (
            <button
              key={m.id}
              className={`member-card${payerId === m.user_id ? " active" : ""}`}
              style={memberVars(m.palette)}
              onClick={() => setPayerIdOverride(m.user_id)}
            >
              <div className="member-card-row">
                <MemberAvatar member={m} size={26} />
                <strong>{m.display_name}</strong>
              </div>
              <small>{payerId === m.user_id ? t("payer_selected_label") : t("payer_tap_label")}</small>
            </button>
          ))}
        </div>

        {payer && (
          <div className="payer-now" style={memberVars(payerPalette)}>
            <div>
              <strong>{t("payer_now_heading", { name: payer.display_name })}</strong>
              <small>{t("payer_now_subtext", { name: payer.display_name })}</small>
            </div>
            <span className="payer-badge">
              <MemberAvatar member={payer} size={18} maxLetters={1} />
              {paletteFor(payerPalette).name}
            </span>
          </div>
        )}

        <div className="segment section-gap">
          <button className={kind === "expense" ? "active" : ""} onClick={() => setKind("expense")}>
            {t("segment_expense")}
          </button>
          <button className={kind === "credit" ? "active" : ""} onClick={() => setKind("credit")}>
            {t("segment_credit")}
          </button>
        </div>

        <div className="card-title subhead">
          <div>
            <h3>{t("category_heading")}</h3>
          </div>
          <button className="link" onClick={() => openModal({ type: "categoryManager" })}>
            {t("category_manage_btn")}
          </button>
        </div>
        <div className="chips">
          {activeCategories.map((c) => (
            <button
              key={c.id}
              className={`chip${categoryId === c.id ? " active" : ""}`}
              onClick={() => setCategoryIdOverride(c.id)}
            >
              {c.name}
              {c.grp === "housing" && <span className="tag-housing">{t("add_category_housing_tag")}</span>}
            </button>
          ))}
          <button className="chip add" onClick={() => openModal({ type: "categoryManager" })}>
            {t("category_add_chip")}
          </button>
        </div>

        <div className="amount-box payer-tinted" style={memberVars(payerPalette)}>
          <span className="currency">{symbol(activeSpace?.currency || "EUR")}</span>
          <input
            className={`amount${kind === "credit" ? " credit" : ""}`}
            inputMode="decimal"
            placeholder={t("amount_placeholder")}
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="field">
          <input
            className="input"
            placeholder={t("note_placeholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <details className="section-gap" open={splitOpen} onToggle={(e) => setSplitOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="muted" style={{ fontWeight: 850, cursor: "pointer" }}>
            {t("split_options_summary")}
          </summary>
          <div className="field">
            <label>{t("split_method_label")}</label>
            <select className="select" value={splitMethod} onChange={(e) => setSplitMethod(e.target.value as SplitType)}>
              <option value="equal">{t("split_option_equal")}</option>
              <option value="percent">{t("split_option_percent")}</option>
              <option value="shares">{t("split_option_shares")}</option>
              <option value="amounts">{t("split_option_amounts")}</option>
            </select>
          </div>
          <div className="field">
            <label>{t("shared_by_label")}</label>
            <div className="chips">
              {members.map((m) => (
                <button
                  key={m.id}
                  className={`chip person-chip${participantIds.has(m.user_id) ? " active" : ""}`}
                  style={memberVars(m.palette)}
                  onClick={() => toggleParticipant(m.user_id)}
                >
                  <MemberAvatar member={m} size={16} maxLetters={1} />
                  {m.display_name}
                </button>
              ))}
            </div>
          </div>
          {splitMethod === "equal" ? (
            <p className="mini" style={{ margin: "10px 0 0" }}>
              {t("split_equal_note", { count: participantIds.size })}
            </p>
          ) : (
            <div className="field">
              <label>
                {splitMethod === "percent"
                  ? t("split_percentages_label")
                  : splitMethod === "shares"
                    ? t("split_shares_label")
                    : t("split_custom_amounts_label")}
              </label>
              {[...participantIds].map((id) => {
                const m = members.find((mm) => mm.user_id === id);
                if (!m) return null;
                return (
                  <div className="grid2" style={{ marginBottom: 7 }} key={id}>
                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder={m.display_name}
                      value={splitValues[id] || ""}
                      onChange={(e) => setSplitValues((prev) => ({ ...prev, [id]: e.target.value }))}
                    />
                    <span className="pill" style={{ boxShadow: "none" }}>
                      {splitLabel}
                    </span>
                  </div>
                );
              })}
              <p className="mini">{t("split_remainder_note")}</p>
            </div>
          )}
        </details>

        <div className="date-repeat-row section-gap">
          <label className="ghost date-field">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button className={`ghost toggle-pill${repeat ? " on" : ""}`} onClick={() => setRepeat((r) => !r)}>
            {repeat && <IconCheck width={14} height={14} />}
            {repeat ? t("repeat_on") : t("repeat_off")}
          </button>
        </div>

        <button
          className={`primary${kind === "credit" ? " green" : ""}`}
          style={{ marginTop: 12, background: `linear-gradient(135deg, ${paletteFor(payerPalette).accent}, ${paletteFor(payerPalette).dark})` }}
          disabled={!payerId || !categoryId || !amount || submitting}
          onClick={handleSubmit}
        >
          {t(kind === "credit" ? "submit_credit" : "submit_expense", { name: payer?.display_name ?? "" })}
        </button>
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>{t("balance_card_title")}</h2>
            <p>{t("balance_card_subtitle", { month: monthName(selectedMonth) })}</p>
          </div>
        </div>
        {debts.length === 0 ? (
          <div className="hero balanced">
            <div className="hero-label">{t("balance_settle_label")}</div>
            <div className="flow">{t("balance_all_square")}</div>
            <div className="big-money zero">{money(0, activeSpace?.currency)}</div>
            <div className="hero-text">{t("balance_settled_text", { month: monthName(selectedMonth) })}</div>
          </div>
        ) : (
          <div className="hero">
            <div className="hero-label">{t("balance_settle_label")}</div>
            <div className="flow">
              <MemberAvatar member={members.find((m) => m.user_id === debts[0].fromId)} size={22} maxLetters={1} />
              <span>{members.find((m) => m.user_id === debts[0].fromId)?.display_name}</span>
              <span className="arrow">→</span>
              <MemberAvatar member={members.find((m) => m.user_id === debts[0].toId)} size={22} maxLetters={1} />
              <span>{members.find((m) => m.user_id === debts[0].toId)?.display_name}</span>
            </div>
            <div
              className="big-money"
              style={
                profile?.id === debts[0].toId
                  ? { color: "var(--green)" }
                  : profile?.id === debts[0].fromId
                    ? { color: "var(--accent-dark)" }
                    : undefined
              }
            >
              <AnimatedMoney value={debts[0].amount} currency={activeSpace?.currency} />
            </div>
            <div className="hero-text">{t("balance_open_text")}</div>
          </div>
        )}
      </div>
    </>
  );
}
