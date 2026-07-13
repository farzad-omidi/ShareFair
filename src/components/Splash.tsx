"use client";

import { useLanguage } from "@/lib/i18n/context";

// Shown while the app is authenticating or loading a signed-in member's first
// batch of data -- both the brief server-side gap (via app/loading.tsx) and the
// client-side SpaceProvider load (via AppShell's `loading` state) render this
// same component, so the two moments read as one continuous launch rather than
// a flash of blank page followed by a different spinner.
export function Splash() {
  const { t } = useLanguage();
  return (
    <div className="splash">
      <div className="splash-mark">
        <img src="/icons/icon-192.png" alt="" width={88} height={88} />
      </div>
      <h1 className="splash-brand">{t("login_brand")}</h1>
      <p className="splash-tagline">{t("login_footer_tagline")}</p>
      <div className="spinner" />
    </div>
  );
}
