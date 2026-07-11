"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ACTIVE_SPACE_STORAGE_KEY } from "@/lib/store";

export function JoinRedeemer({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("redeem_invite", { p_code: code });
      if (cancelled) return;
      if (error || !data) {
        setError(error?.message || "This invite link is invalid or has expired.");
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

  if (error) {
    return (
      <div className="center-screen">
        <div className="card" style={{ maxWidth: 420 }}>
          <div className="card-title">
            <div>
              <h2>Couldn&apos;t join</h2>
              <p>{error}</p>
            </div>
          </div>
          <button className="primary" onClick={() => router.replace("/")}>
            Go to ShareFair
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
