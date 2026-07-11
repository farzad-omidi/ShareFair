"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const linkError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus("error");
      const message = error.message?.trim();
      setError(
        message && message !== "{}"
          ? message
          : "Something went wrong sending that email. Please try again in a moment."
      );
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="center-screen">
      <div className="glow" />
      <div className="app-shell" style={{ paddingBottom: 24 }}>
        <div style={{ textAlign: "center", margin: "20px 0 8px" }}>
          <div className="eyebrow">Shared expenses, done fairly</div>
          <h1 className="brand" style={{ fontSize: "clamp(38px,10vw,52px)" }}>
            ShareFair
          </h1>
        </div>

        <div className="card">
          {status === "sent" ? (
            <>
              <div className="card-title">
                <div>
                  <h2>Check your email</h2>
                  <p>
                    We sent a sign-in link to <strong>{email}</strong>. Open it on this
                    device to continue.
                  </p>
                </div>
              </div>
              <button className="ghost" style={{ width: "100%" }} onClick={() => setStatus("idle")}>
                Use a different email
              </button>
            </>
          ) : (
            <>
              <div className="card-title">
                <div>
                  <h2>Sign in</h2>
                  <p>No password needed — we&apos;ll email you a magic link.</p>
                </div>
              </div>
              {linkError && (
                <p className="mini" style={{ color: "var(--red)", marginBottom: 8 }}>
                  That sign-in link doesn&apos;t work anymore — request a new one below.
                </p>
              )}
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>Email</label>
                  <input
                    className="input"
                    type="email"
                    required
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && (
                  <p className="mini" style={{ color: "var(--red)", marginTop: 8 }}>
                    {error}
                  </p>
                )}
                <button className="primary" type="submit" disabled={status === "sending"} style={{ marginTop: 14 }}>
                  {status === "sending" ? "Sending…" : "Send magic link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mini" style={{ textAlign: "center", padding: "0 20px" }}>
          A fair, transparent way to split expenses with roommates, partners, family, or
          a trip crew.
        </p>
      </div>
    </div>
  );
}
