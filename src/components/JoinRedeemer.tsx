"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVE_SPACE_STORAGE_KEY } from "@/lib/store";
import { useLanguage } from "@/lib/i18n/context";

export function JoinRedeemer({ code }: { code: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  // `error` holds the raw message from Supabase (if any); `failed` tracks
  // whether the redemption attempt failed at all, so the fallback copy can
  // be resolved via t() at render time instead of being baked into state --
  // that keeps this effect's dependency array free of `t`, whose identity
  // changes whenever the language preference loads from localStorage after
  // mount, which would otherwise re-run the effect and redeem the code twice.
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
      if (cancelled) return;
      if (error || !data) {
        setError(error?.message || null);
        setFailed(true);
        return;
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_SPACE_STORAGE_KEY, data);
      }
      router.replace("/");
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (failed) {
    return (
      <div className="center-screen">
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="card-title">
            <div>
              <h2>{t("join_failed_title")}</h2>
              <p>{error || t("join_link_expired")}</p>
            </div>
          </div>
          <button className="primary" onClick={() => router.replace("/")}>
            {t("join_go_home_btn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="center-screen">
      <div className="spinner" />
    </div>
  );
}
