"use client";

import { useState, type FormEvent } from "react";
import { useSpace } from "@/lib/store";
import { useLanguage } from "@/lib/i18n/context";
import { CURRENCIES } from "@/lib/currencies";

export function Onboarding() {
  const { createSpace, joinSpaceByCode, signOut } = useSpace();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("Our Home");
  const [currency, setCurrency] = useState("EUR");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await createSpace(name.trim(), currency);
    setBusy(false);
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    const res = await joinSpaceByCode(code);
    setBusy(false);
    if (!res.ok) setError(res.error || "That invite code doesn't look right");
  }

  return (
    <div className="center-screen">
      <div className="glow" />
      <div className="app-shell" style={{ paddingBottom: 24 }}>
        <div style={{ textAlign: "center", margin: "12px 0 8px" }}>
          <div className="eyebrow">{t("onboarding_eyebrow")}</div>
          <h1 className="brand" style={{ fontSize: "clamp(32px,9vw,44px)" }}>
            {t("onboarding_headline")}
          </h1>
          <p className="mini" style={{ marginTop: 8 }}>
            {t("onboarding_subtitle")}
          </p>
        </div>

        <div className="card">
          <div className="segment">
            <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>
              {t("onboarding_tab_create")}
            </button>
            <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>
              {t("onboarding_tab_join")}
            </button>
          </div>

          {mode === "create" ? (
            <form onSubmit={handleCreate}>
              <div className="field">
                <label>{t("field_space_name")}</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Our Home" />
              </div>
              <div className="field">
                <label>{t("field_currency")}</label>
                <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <button className="primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>
                {busy ? t("create_btn_busy") : t("create_btn_idle")}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin}>
              <div className="field">
                <label>{t("field_invite_code")}</label>
                <input
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. a1b2c3d4"
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
              {error && (
                <p className="mini" style={{ color: "var(--red)", marginTop: 8 }}>
                  {error}
                </p>
              )}
              <button className="primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>
                {busy ? t("join_btn_busy") : t("join_btn_idle")}
              </button>
            </form>
          )}
        </div>

        <button className="ghost" style={{ width: "100%" }} onClick={signOut}>
          {t("account_signout_btn")}
        </button>
      </div>
    </div>
  );
}
