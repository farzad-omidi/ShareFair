"use client";

import { useEffect, useRef, useState } from "react";
import { useSpace } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useLanguage } from "@/lib/i18n/context";
import { money } from "@/lib/format";
import { MemberAvatar } from "@/components/Avatar";
import { IconBell, IconCheck, IconX } from "@/components/icons";
import type { AppNotification } from "@/lib/types";

const AUTO_DISMISS_MS = 9000;

// A gentle, one-at-a-time banner for the three moments someone else's action
// now needs a response from the current user (see AppNotification's own
// comment for why this is separate from the plain-text `toast`). Shows only
// the front of the queue -- if more than one arrives close together, the
// next slides in once the first is dismissed or acted on, rather than
// stacking several at once.
export function NotificationBanner() {
  const { notifications } = useSpace();
  const current = notifications[0];
  if (!current) return null;
  // Keying by id remounts the card (and resets its local `busy` state) each
  // time the front of the queue changes, instead of reaching for setState
  // inside an effect to do the same job.
  return <NotificationCard key={current.id} n={current} />;
}

function NotificationCard({ n }: { n: AppNotification }) {
  const { dismissNotification, confirmSettlement, declineSettlement, respondToInvitation } = useSpace();
  const { setView } = useUI();
  const { t } = useLanguage();
  const current = n;
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => dismissNotification(current.id), AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current.id, dismissNotification]);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    await action();
    dismissNotification(current.id);
  }

  return (
    <div className="notif-wrap">
      <div className={`notif-banner ${current.type}`}>
        <button
          className="notif-close"
          aria-label={t("notif_dismiss_label")}
          onClick={() => dismissNotification(current.id)}
        >
          <IconX width={13} height={13} />
        </button>

        {current.type === "payment_request" && (
          <>
            <div className="notif-head">
              <MemberAvatar
                member={{ display_name: current.requesterName, palette: current.requesterPalette }}
                size={34}
                maxLetters={1}
              />
              <div>
                <div className="notif-kicker">{t("notif_payment_request_title")}</div>
                <div className="notif-amount">{money(current.amount, current.currency)}</div>
              </div>
            </div>
            <p className="notif-body">{t("settle_requested_note", { name: current.requesterName })}</p>
            <div className="grid2">
              <button className="ghost" disabled={busy} onClick={() => dismissNotification(current.id)}>
                {t("unlock_maybe_later")}
              </button>
              <button
                className="primary green"
                disabled={busy}
                onClick={() => {
                  setView("Settle");
                  dismissNotification(current.id);
                }}
              >
                {t("notif_review_btn")}
              </button>
            </div>
          </>
        )}

        {current.type === "settlement_pending" && (
          <>
            <div className="notif-head">
              <MemberAvatar
                member={{ display_name: current.creatorName, palette: current.creatorPalette }}
                size={34}
                maxLetters={1}
              />
              <div>
                <div className="notif-kicker">{t("notif_settlement_title")}</div>
                <div className="notif-amount">{money(current.amount, current.currency)}</div>
              </div>
            </div>
            <p className="notif-body">{t("settle_confirm_note", { name: current.creatorName })}</p>
            <div className="grid2">
              <button className="ghost" disabled={busy} onClick={() => act(() => declineSettlement(current.entryId))}>
                {t("action_decline")}
              </button>
              <button
                className="primary green"
                disabled={busy}
                onClick={() => act(() => confirmSettlement(current.entryId))}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <IconCheck width={15} height={15} /> {t("action_confirm")}
                </span>
              </button>
            </div>
          </>
        )}

        {current.type === "invitation" && (
          <>
            <div className="notif-head">
              <span className="notif-icon">
                <IconBell width={17} height={17} />
              </span>
              <div>
                <div className="notif-kicker">{t("notif_invitation_title")}</div>
              </div>
            </div>
            <p className="notif-body">
              {t("notif_invitation_body", { name: current.inviterName, space: current.spaceName })}
            </p>
            <div className="grid2">
              <button
                className="ghost"
                disabled={busy}
                onClick={() => act(() => respondToInvitation(current.invitationId, false))}
              >
                {t("action_decline")}
              </button>
              <button
                className="primary green"
                disabled={busy}
                onClick={() => act(() => respondToInvitation(current.invitationId, true))}
              >
                {t("action_confirm")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
