"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/context";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { t } = useLanguage();
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
          : t("login_send_error")
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
          <div className="eyebrow">{t("login_eyebrow")}</div>
          <h1 className="brand" style={{ fontSize: "clamp(38px,10vw,52px)" }}>
            {t("login_brand")}
          </h1>
        </div>

        <div className="card">
          {status === "sent" ? (
            <>
              <div className="card-title">
                <div>
                  <h2>{t("checkemail_title")}</h2>
                  <p>
                    {t("checkemail_body_before")}
                    <strong>{email}</strong>
                    {t("checkemail_body_after")}
                  </p>
                </div>
              </div>
              <button className="ghost" style={{ width: "100%" }} onClick={() => setStatus("idle")}>
                {t("checkemail_different_email_btn")}
              </button>
            </>
          ) : (
            <>
              <div className="card-title">
                <div>
                  <h2>{t("signin_title")}</h2>
                  <p>{t("signin_subtitle")}</p>
                </div>
              </div>
              {linkError && (
                <p className="mini" style={{ color: "var(--red)", marginBottom: 8 }}>
                  {t("login_link_expired")}
                </p>
              )}
              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>{t("field_email")}</label>
                  <input
                    className="input"
                    type="email"
                    required
                    autoFocus
                    placeholder={t("field_email_placeholder")}
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
                  {status === "sending" ? t("signin_submit_busy") : t("signin_submit_idle")}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mini" style={{ textAlign: "center", padding: "0 20px" }}>
          {t("login_footer_tagline")}
        </p>
      </div>
    </div>
  );
}
