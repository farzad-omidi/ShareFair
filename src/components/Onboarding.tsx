"use client";

import { useState, type FormEvent } from "react";
import { useSpace } from "@/lib/store";

const CURRENCIES = ["EUR", "USD", "GBP", "CAD", "AUD", "TRY"];

export function Onboarding() {
  const { createSpace, joinSpaceByCode, signOut } = useSpace();
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
    if (!res.ok) setError(res.error || "Invalid invite code");
  }

  return (
    <div className="center-screen">
      <div className="glow" />
      <div className="app-shell" style={{ paddingBottom: 24 }}>
        <div style={{ textAlign: "center", margin: "12px 0 8px" }}>
          <div className="eyebrow">Welcome</div>
          <h1 className="brand" style={{ fontSize: "clamp(32px,9vw,44px)" }}>
            Let&apos;s set up your space
          </h1>
          <p className="mini" style={{ marginTop: 8 }}>
            A space is where expenses are shared — a home, a trip, a family.
          </p>
        </div>

        <div className="card">
          <div className="segment">
            <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>
              Create a space
            </button>
            <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>
              Join with a code
            </button>
          </div>

          {mode === "create" ? (
            <form onSubmit={handleCreate}>
              <div className="field">
                <label>Space name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Our Home" />
              </div>
              <div className="field">
                <label>Currency</label>
                <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button className="primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>
                {busy ? "Creating…" : "Create space"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoin}>
              <div className="field">
                <label>Invite code</label>
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
                {busy ? "Joining…" : "Join space"}
              </button>
            </form>
          )}
        </div>

        <button className="ghost" style={{ width: "100%" }} onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
