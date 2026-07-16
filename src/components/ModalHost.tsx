"use client";

import { useEffect, useRef, useState } from "react";
import { useUI } from "@/lib/ui";
import { useSpace } from "@/lib/store";
import { useLanguage } from "@/lib/i18n/context";
import { currentMonth, today } from "@/lib/domain";
import { money, symbol } from "@/lib/format";
import { ModalSheet } from "@/components/ModalSheet";
import { PALETTES, memberVars } from "@/lib/palettes";
import { CURRENCIES } from "@/lib/currencies";
import { MemberAvatar } from "@/components/Avatar";
import { IconCheck, IconHeart } from "@/components/icons";
import { Confetti, makeConfettiPieces, type ConfettiPiece } from "@/components/Confetti";
import QRCode from "qrcode";

export function ModalHost() {
  const { modal, closeModal } = useUI();
  if (!modal) return null;

  switch (modal.type) {
    case "month":
      return <MonthModal onClose={closeModal} />;
    case "categoryManager":
      return <CategoryManagerModal onClose={closeModal} />;
    case "editMember":
      return <EditMemberModal memberId={modal.memberId} onClose={closeModal} />;
    case "newSpace":
      return <NewSpaceModal onClose={closeModal} />;
    case "invite":
      return <InviteModal onClose={closeModal} />;
    case "joinSpace":
      return <JoinSpaceModal onClose={closeModal} />;
    case "editEntry":
      return <EditEntryModal entryId={modal.entryId} onClose={closeModal} />;
    case "unlock":
      return <UnlockModal onClose={closeModal} />;
    case "activeSince":
      return <ActiveSinceModal onClose={closeModal} />;
    default:
      return null;
  }
}

const TIP_OPTIONS = [0, 2, 5, 10];
const UNLOCK_PRICE = 1;

// Preview-only: no payment is actually wired up yet. This exists to see how the
// unlock moment (and the thank-you that follows it) looks and feels before
// deciding whether/how to build it for real.
function UnlockModal({ onClose }: { onClose: () => void }) {
  const { activeSpace, unlockAccount } = useSpace();
  const { t } = useLanguage();
  const [tip, setTip] = useState(0);
  const [stage, setStage] = useState<"offer" | "thanks">("offer");
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const total = UNLOCK_PRICE + tip;
  const currency = activeSpace?.currency ?? "EUR";
  // Toman conventionally trails the amount ("2 تومان") while every other
  // supported currency's symbol leads it ("€2") -- keep the tip chips compact
  // (no forced decimals) while still respecting that per-currency ordering.
  const compactAmount = (amt: number) =>
    currency === "IRT" ? `${amt} ${symbol(currency)}` : `${symbol(currency)}${amt}`;

  if (stage === "thanks") {
    return (
      <ModalSheet onClose={onClose}>
        <div className="hero balanced thanks-card">
          <Confetti pieces={confettiPieces} />
          <div className="thanks-icon">
            <IconHeart width={22} height={22} />
          </div>
          <div className="flow">{t("unlock_thanks_heading")}</div>
          <div className="hero-text">
            {t("unlock_thanks_body")}
            {tip > 0 && " " + t("unlock_thanks_tip_note")}
          </div>
        </div>
        <div className="modal-actions">
          <button className="primary" style={{ gridColumn: "1 / -1" }} onClick={onClose}>
            {t("action_done")}
          </button>
        </div>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet onClose={onClose}>
      <div className="hero balanced">
        <div className="hero-label">{t("unlock_hero_label")}</div>
        <div className="flow">
          <IconCheck width={20} height={20} />
          {t("unlock_offer_heading", { name: activeSpace?.name ?? t("fallback_your_space") })}
        </div>
        <div className="hero-text">{t("unlock_offer_body")}</div>
      </div>

      <h3>{t("unlock_cta_heading", { name: activeSpace?.name ?? t("fallback_this_space") })}</h3>
      <p className="sub">{t("unlock_sub")}</p>

      <div className="unlock-benefits">
        <div>
          <IconCheck width={15} height={15} />
          {t("unlock_benefit_everyone", { name: activeSpace?.name ?? t("fallback_this_space") })}
        </div>
        <div>
          <IconCheck width={15} height={15} />
          {t("unlock_benefit_forever")}
        </div>
        <div>
          <IconCheck width={15} height={15} />
          {t("unlock_benefit_history")}
        </div>
      </div>

      <div className="field">
        <label>{t("unlock_tip_label")}</label>
        <div className="chips">
          {TIP_OPTIONS.map((amt) => (
            <button key={amt} className={`chip${tip === amt ? " active" : ""}`} onClick={() => setTip(amt)}>
              {amt === 0 ? t("unlock_tip_none") : t("unlock_tip_chip", { amount: compactAmount(amt) })}
            </button>
          ))}
        </div>
        <p className="mini" style={{ margin: "6px 0 0" }}>
          {t("unlock_tip_hint")}
        </p>
      </div>

      <div style={{ textAlign: "center", margin: "14px 0 16px" }}>
        <div className="big-money">{money(total, currency)}</div>
        <p className="mini">
          {tip > 0
            ? t("unlock_summary_with_tip", { unlock: money(UNLOCK_PRICE, currency), tip: money(tip, currency) })
            : t("unlock_summary_once")}
        </p>
      </div>

      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          {t("unlock_maybe_later")}
        </button>
        <button
          className="primary green"
          onClick={() => {
            // Instant feedback, matching the rest of the app's "peak-end moment"
            // pattern (e.g. SettleView's settle animation) -- the actual write
            // happens in the background rather than delaying the celebration.
            setConfettiPieces(makeConfettiPieces());
            setStage("thanks");
            void unlockAccount();
          }}
        >
          {t("unlock_cta_button", { amount: money(total, currency) })}
        </button>
      </div>
    </ModalSheet>
  );
}

function ActiveSinceModal({ onClose }: { onClose: () => void }) {
  const { activeSpace, setMyActiveSince } = useSpace();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"choose" | "date">("choose");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);

  async function confirm(value: string) {
    setBusy(true);
    await setMyActiveSince(value);
    setBusy(false);
    onClose();
  }

  return (
    <ModalSheet onClose={onClose}>
      <h3>{t("active_since_welcome", { name: activeSpace?.name ?? t("fallback_the_space") })}</h3>
      <p className="sub">{t("active_since_sub")}</p>

      {mode === "choose" ? (
        <div className="modal-actions">
          <button className="ghost" disabled={busy} onClick={() => setMode("date")}>
            {t("active_since_pick_date")}
          </button>
          <button className="primary" disabled={busy} onClick={() => confirm(today())}>
            {t("active_since_from_now")}
          </button>
        </div>
      ) : (
        <>
          <div className="field">
            <label>{t("active_since_label")}</label>
            <input
              className="input"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button className="ghost" disabled={busy} onClick={() => setMode("choose")}>
              {t("action_back")}
            </button>
            <button className="primary" disabled={busy || !date} onClick={() => confirm(date)}>
              {t("action_confirm")}
            </button>
          </div>
        </>
      )}
    </ModalSheet>
  );
}

function MonthModal({ onClose }: { onClose: () => void }) {
  const { selectedMonth, setSelectedMonth } = useSpace();
  const { t } = useLanguage();
  const [val, setVal] = useState(selectedMonth);
  return (
    <ModalSheet onClose={onClose}>
      <h3>{t("month_modal_title")}</h3>
      <p className="sub">{t("month_modal_sub")}</p>
      <div className="field">
        <label>{t("month_modal_label")}</label>
        <input className="input" type="month" value={val} onChange={(e) => setVal(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          {t("action_cancel")}
        </button>
        <button
          className="primary"
          onClick={() => {
            setSelectedMonth(val || currentMonth());
            onClose();
          }}
        >
          {t("month_modal_use")}
        </button>
      </div>
    </ModalSheet>
  );
}

function CategoryManagerModal({ onClose }: { onClose: () => void }) {
  const { categories, addCategory, toggleCategory } = useSpace();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [housing, setHousing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <ModalSheet onClose={onClose}>
      <h3>{t("categories_modal_title")}</h3>
      <p className="sub">{t("categories_modal_subtitle")}</p>
      <div>
        {categories.map((c) => (
          <div className="row" key={c.id}>
            <div>
              <strong>{c.name}</strong>
              <small>
                {c.grp === "housing" ? t("category_group_housing") : t("category_group_regular")} ·{" "}
                {c.active ? t("category_status_visible") : t("category_status_hidden")}
              </small>
            </div>
            <button className="ghost" onClick={() => toggleCategory(c.id)}>
              {c.active ? t("category_action_hide") : t("category_action_show")}
            </button>
          </div>
        ))}
      </div>
      <div className="field">
        <label>{t("category_new_label")}</label>
        <input
          className="input"
          placeholder={t("category_new_placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="switch-line">
        <div>
          <strong>{t("category_housing_label")}</strong>
          <small className="mini">{t("category_housing_hint")}</small>
        </div>
        <label className="switch">
          <input type="checkbox" checked={housing} onChange={(e) => setHousing(e.target.checked)} />
          <span className="track"></span>
        </label>
      </div>
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          {t("action_done")}
        </button>
        <button
          className="primary"
          disabled={submitting}
          onClick={async () => {
            const trimmed = name.trim();
            if (!trimmed) return;
            setSubmitting(true);
            try {
              await addCategory(trimmed, housing ? "housing" : "daily");
              setName("");
              setHousing(false);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {t("category_add_btn")}
        </button>
      </div>
    </ModalSheet>
  );
}

function EditMemberModal({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const { members, updateMyMembership, setMyActiveSince, profile } = useSpace();
  const { t } = useLanguage();
  const m = members.find((x) => x.id === memberId);
  const canEdit = !!m && !!profile && m.user_id === profile.id;
  const [name, setName] = useState(m?.display_name || "");
  const [palette, setPalette] = useState(m?.palette ?? 0);
  const [activeSince, setActiveSince] = useState(m?.active_since || today());

  if (!m) return null;

  return (
    <ModalSheet onClose={onClose}>
      <h3>{canEdit ? t("member_modal_your_profile") : m.display_name}</h3>
      <p className="sub">
        {canEdit
          ? t("member_modal_subtitle_self")
          : t("member_modal_subtitle_other", { name: m.display_name })}
      </p>
      {canEdit ? (
        <>
          <div className="field">
            <label>{t("field_name")}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>{t("field_color_palette")}</label>
            <div className="color-grid">
              {PALETTES.map((p, i) => (
                <button
                  type="button"
                  key={p.name}
                  className={`color-choice${i === palette ? " active" : ""}`}
                  style={memberVars(i)}
                  onClick={() => setPalette(i)}
                >
                  <span></span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>{t("field_involved_since")}</label>
            <input
              className="input"
              type="date"
              value={activeSince}
              max={today()}
              onChange={(e) => setActiveSince(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button className="ghost" onClick={onClose}>
              {t("action_cancel")}
            </button>
            <button
              className="primary"
              onClick={async () => {
                const trimmed = name.trim();
                if (!trimmed) return;
                await updateMyMembership(trimmed, palette);
                if (activeSince !== m.active_since) await setMyActiveSince(activeSince);
                onClose();
              }}
            >
              {t("action_save")}
            </button>
          </div>
        </>
      ) : (
        <div className="modal-actions" style={{ gridTemplateColumns: "1fr" }}>
          <button className="ghost" onClick={onClose}>
            {t("action_close")}
          </button>
        </div>
      )}
    </ModalSheet>
  );
}

function NewSpaceModal({ onClose }: { onClose: () => void }) {
  const { createSpace, getPastCollaborators, sendSpaceInvitation, spaces, profile } = useSpace();
  const { openModal } = useUI();
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"create" | "invite">("create");
  const [newSpaceId, setNewSpaceId] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<
    { user_id: string; display_name: string; palette: number }[]
  >([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);
  useEffect(() => {
    // Explicitly re-arm on setup (not just clear on cleanup) -- React 18 Strict
    // Mode's dev-only mount/cleanup/remount double-invoke would otherwise leave
    // this stuck at `false` after the very first render, even though the
    // component is genuinely still mounted.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const createdId = await createSpace(trimmed, currency);
    if (!mountedRef.current) return;
    setBusy(false);
    if (createdId) {
      setNewSpaceId(createdId);
      // Fetch fresh against the new space's own (currently just-me) member
      // list, not whatever was active a moment ago.
      const people = await getPastCollaborators(createdId);
      if (!mountedRef.current) return;
      setCollaborators(people);
      setStage("invite");
    } else {
      onClose();
    }
  }

  async function inviteChip(p: { user_id: string; display_name: string }) {
    if (!newSpaceId || invitedIds.has(p.user_id) || sendingIds.has(p.user_id)) return;
    setSendingIds((prev) => new Set(prev).add(p.user_id));
    await sendSpaceInvitation(newSpaceId, p.user_id);
    if (!mountedRef.current) return;
    setSendingIds((prev) => {
      const next = new Set(prev);
      next.delete(p.user_id);
      return next;
    });
    setInvitedIds((prev) => new Set(prev).add(p.user_id));
  }

  // Free tier: one owned space per account (joining someone else's space is
  // always unrestricted, so this never blocks the invite-your-friends loop --
  // only how many spaces you can personally create). Checked client-side here
  // so the limit surfaces as a clear next step rather than a failed submit;
  // create_space's own server-side check is what actually enforces it.
  const ownsAnySpace = spaces.some((s) => s.created_by === profile?.id);
  const atFreeLimit = ownsAnySpace && !profile?.unlocked;

  if (atFreeLimit) {
    return (
      <ModalSheet onClose={onClose}>
        <h3>{t("newspace_limit_title")}</h3>
        <p className="sub">{t("newspace_limit_body")}</p>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            {t("action_close")}
          </button>
          <button className="primary green" onClick={() => openModal({ type: "unlock" })}>
            {t("newspace_limit_cta")}
          </button>
        </div>
      </ModalSheet>
    );
  }

  if (stage === "invite") {
    return (
      <ModalSheet onClose={onClose}>
        <h3>{t("newspace_invite_heading", { name: name.trim() })}</h3>
        <p className="sub">{t("newspace_invite_subtitle")}</p>
        {collaborators.length > 0 ? (
          <div className="field">
            <div className="chips">
              {collaborators.map((p) => {
                const invited = invitedIds.has(p.user_id);
                return (
                  <button
                    key={p.user_id}
                    className={`chip person-chip${invited ? " active" : ""}`}
                    style={memberVars(p.palette)}
                    disabled={invited || sendingIds.has(p.user_id)}
                    onClick={() => inviteChip(p)}
                  >
                    <MemberAvatar member={p} size={16} maxLetters={1} />
                    {p.display_name}
                    {invited ? ` · ${t("newspace_invited_chip_suffix")}` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="empty">{t("newspace_no_collaborators")}</div>
        )}
        <div className="modal-actions">
          <button className="primary" style={{ gridColumn: "1 / -1" }} onClick={onClose}>
            {t("newspace_done_btn")}
          </button>
        </div>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet onClose={onClose}>
      <h3>{t("newspace_title")}</h3>
      <p className="sub">{t("newspace_subtitle")}</p>
      <div className="field">
        <label>{t("field_name")}</label>
        <input
          className="input"
          placeholder={t("newspace_name_placeholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
      <div className="modal-actions">
        <button className="ghost" disabled={busy} onClick={onClose}>
          {t("action_cancel")}
        </button>
        <button className="primary" disabled={busy || !name.trim()} onClick={handleCreate}>
          {busy ? t("newspace_creating_btn") : t("newspace_create_btn")}
        </button>
      </div>
    </ModalSheet>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const { createInvite, activeSpace, getPastCollaborators, sendSpaceInvitation, showToast } = useSpace();
  const { t } = useLanguage();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<
    { user_id: string; display_name: string; palette: number }[]
  >([]);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      const [c, people] = await Promise.all([createInvite(), getPastCollaborators()]);
      if (!cancelled) {
        setCode(c);
        setCollaborators(people);
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = code && typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : "";

  useEffect(() => {
    if (!link) return;
    let cancelled = false;
    // Generated entirely client-side -- the invite link never leaves the device
    // just to render a QR code, unlike a third-party QR image API would.
    QRCode.toDataURL(link, { margin: 1, width: 200 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [link]);

  function shareText(name?: string) {
    return name
      ? `Hey ${name}, join "${activeSpace?.name}" on ShareFair: ${link}`
      : `Join "${activeSpace?.name}" on ShareFair: ${link}`;
  }

  async function share(name?: string) {
    const text = shareText(name);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `Join ${activeSpace?.name}`, text, url: link });
        return;
      } catch {
        // User cancelled, or the platform rejected it -- fall back to clipboard below
        // rather than leaving them with no way to actually send the invite.
      }
    }
    navigator.clipboard?.writeText(text).catch(() => {});
    showToast(name ? t("invite_copied_named_toast", { name }) : t("invite_copied_generic_toast"));
  }

  // Tapping a past-collaborator chip both shares the link text (in case they
  // don't have the app open) AND sends a real in-app invitation they can accept
  // from their own pending-invitations list once they do.
  async function inviteCollaborator(p: { user_id: string; display_name: string }) {
    await share(p.display_name);
    if (!activeSpace || invitedIds.has(p.user_id) || sendingIds.has(p.user_id)) return;
    setSendingIds((prev) => new Set(prev).add(p.user_id));
    await sendSpaceInvitation(activeSpace.id, p.user_id);
    setSendingIds((prev) => {
      const next = new Set(prev);
      next.delete(p.user_id);
      return next;
    });
    setInvitedIds((prev) => new Set(prev).add(p.user_id));
  }

  return (
    <ModalSheet onClose={onClose}>
      <h3>{t("invite_title", { name: activeSpace?.name ?? "" })}</h3>
      <p className="sub">{t("invite_subtitle")}</p>
      {busy ? (
        <div className="empty">{t("invite_creating")}</div>
      ) : link ? (
        <>
          {qrDataUrl && (
            <div className="qr-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, not an optimizable remote image */}
              <img src={qrDataUrl} alt={t("invite_qr_alt")} width={168} height={168} />
            </div>
          )}
          <div className="field">
            <label>{t("invite_link_label")}</label>
            <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
          <div className="field">
            <label>{t("invite_code_label")}</label>
            <div className="pill" style={{ justifyContent: "flex-start", fontSize: 18, letterSpacing: "0.08em" }}>
              {code}
            </div>
          </div>
          {collaborators.length > 0 && (
            <div className="field">
              <label>{t("invite_collaborators_label")}</label>
              <div className="chips">
                {collaborators.map((p) => {
                  const invited = invitedIds.has(p.user_id);
                  return (
                    <button
                      key={p.user_id}
                      className={`chip person-chip${invited ? " active" : ""}`}
                      style={memberVars(p.palette)}
                      disabled={sendingIds.has(p.user_id)}
                      onClick={() => inviteCollaborator(p)}
                    >
                      <MemberAvatar member={p} size={16} maxLetters={1} />
                      {p.display_name}
                      {invited ? ` · ${t("newspace_invited_chip_suffix")}` : ""}
                    </button>
                  );
                })}
              </div>
              <p className="mini" style={{ margin: "6px 0 0" }}>
                {t("invite_collaborators_mini")}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="empty">{t("invite_create_failed")}</div>
      )}
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          {t("action_close")}
        </button>
        <button className="primary" disabled={!link} onClick={() => share()}>
          {t("invite_share_btn")}
        </button>
      </div>
      {link && (
        <button
          className="link"
          style={{ width: "100%", marginTop: 10, textAlign: "center" }}
          onClick={() => {
            navigator.clipboard?.writeText(link).catch(() => {});
            showToast(t("invite_link_copied_toast"));
          }}
        >
          {t("invite_copy_link_btn")}
        </button>
      )}
    </ModalSheet>
  );
}

function JoinSpaceModal({ onClose }: { onClose: () => void }) {
  const { joinSpaceByCode } = useSpace();
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalSheet onClose={onClose}>
      <h3>{t("joinspace_modal_title")}</h3>
      <p className="sub">{t("joinspace_modal_subtitle")}</p>
      <div className="field">
        <label>{t("field_invite_code")}</label>
        <input
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("joinspace_code_placeholder")}
        />
      </div>
      {error && (
        <p className="mini" style={{ color: "var(--red)", marginTop: 8 }}>
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          {t("action_cancel")}
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            if (!code.trim()) return;
            setBusy(true);
            setError(null);
            const res = await joinSpaceByCode(code);
            setBusy(false);
            if (res.ok) onClose();
            else setError(res.error || t("error_invalid_invite_code"));
          }}
        >
          {busy ? t("join_btn_busy") : t("joinspace_submit_btn")}
        </button>
      </div>
    </ModalSheet>
  );
}

function EditEntryModal({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const { entries, members, profile, updateEntry, deleteEntry, confirmSettlement, declineSettlement, activeSpace } =
    useSpace();
  const { t } = useLanguage();
  const e = entries.find((x) => x.id === entryId);
  const [amount, setAmount] = useState(e ? String(e.amount) : "");
  const [note, setNote] = useState(e?.note || "");
  const [date, setDate] = useState(e?.entry_date || "");
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set(e?.participant_ids ?? []));
  const [recurring, setRecurring] = useState(e?.recurring ?? false);
  const [submitting, setSubmitting] = useState(false);

  if (!e) return null;

  const myMember = members.find((m) => m.user_id === profile?.id);
  // Matches the server-side rule: the entry's author, the space owner, or (for an
  // expense/credit) whoever it's attributed to as payer can edit/delete it —
  // everyone else sees the entry without those options at all, rather than a
  // button that fails with a confusing error.
  const canDelete =
    e.created_by === profile?.id ||
    myMember?.role === "owner" ||
    ((e.kind === "expense" || e.kind === "credit") && e.payer_id === profile?.id);

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (e.kind === "settlement") {
    const from = members.find((m) => m.user_id === e.from_id);
    const to = members.find((m) => m.user_id === e.to_id);
    const fromName = from?.display_name ?? t("person_someone_cap");
    const toName = to?.display_name ?? t("person_someone_lower");

    if (e.status === "pending") {
      const iAmConfirmer = profile?.id !== e.created_by && (profile?.id === e.from_id || profile?.id === e.to_id);
      const iAmInitiator = profile?.id === e.created_by;
      return (
        <ModalSheet onClose={onClose}>
          <h3>{t("entry_settling_heading")}</h3>
          <p className="sub">{t("entry_pending_sub", { from: fromName, to: toName })}</p>
          <div className="big-money">{money(e.amount, activeSpace?.currency)}</div>
          {iAmConfirmer ? (
            <>
              <p className="mini" style={{ margin: "0 0 14px" }}>
                {t("entry_confirm_note")}
              </p>
              <div className="modal-actions">
                <button
                  className="ghost"
                  disabled={submitting}
                  onClick={async () => {
                    if (submitting) return;
                    setSubmitting(true);
                    try {
                      await declineSettlement(entryId);
                      onClose();
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {t("action_decline")}
                </button>
                <button
                  className="primary green"
                  disabled={submitting}
                  onClick={async () => {
                    if (submitting) return;
                    setSubmitting(true);
                    try {
                      await confirmSettlement(entryId);
                      onClose();
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {t("action_confirm")}
                </button>
              </div>
            </>
          ) : (
            <div className="modal-actions">
              <button
                className="ghost"
                onClick={onClose}
                style={iAmInitiator ? undefined : { gridColumn: "1 / -1" }}
              >
                {t("action_close")}
              </button>
              {iAmInitiator && (
                <button
                  className="danger"
                  disabled={submitting}
                  onClick={async () => {
                    if (submitting) return;
                    setSubmitting(true);
                    try {
                      await declineSettlement(entryId);
                      onClose();
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  {t("settle_cancel_request_btn")}
                </button>
              )}
            </div>
          )}
        </ModalSheet>
      );
    }

    return (
      <ModalSheet onClose={onClose}>
        <h3>{t("entry_settled_heading")}</h3>
        <p className="sub">{t("entry_settled", { from: fromName, to: toName })}</p>
        <div className="big-money">{money(e.amount, activeSpace?.currency)}</div>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose} style={canDelete ? undefined : { gridColumn: "1 / -1" }}>
            {t("action_close")}
          </button>
          {canDelete && (
            <button
              className="danger"
              disabled={submitting}
              onClick={async () => {
                if (submitting) return;
                setSubmitting(true);
                try {
                  await deleteEntry(entryId);
                  onClose();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {t("action_delete")}
            </button>
          )}
        </div>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet onClose={onClose}>
      <h3>{t("edit_entry_title")}</h3>
      {!canDelete && <p className="sub">{t("edit_entry_readonly_note")}</p>}
      <div className="field">
        <label>{t("field_amount")}</label>
        <input
          className="input"
          inputMode="decimal"
          value={amount}
          disabled={!canDelete}
          onChange={(ev) => setAmount(ev.target.value)}
        />
      </div>
      <div className="field">
        <label>{t("field_note")}</label>
        <input className="input" value={note} disabled={!canDelete} onChange={(ev) => setNote(ev.target.value)} />
      </div>
      <div className="field">
        <label>{t("field_date")}</label>
        <input
          className="input"
          type="date"
          value={date}
          disabled={!canDelete}
          onChange={(ev) => setDate(ev.target.value)}
        />
      </div>
      <div className="field">
        <label>{t("shared_by_label")}</label>
        <div className="chips">
          {members.map((m) => (
            <button
              key={m.id}
              className={`chip person-chip${participantIds.has(m.user_id) ? " active" : ""}`}
              style={memberVars(m.palette)}
              disabled={!canDelete}
              onClick={() => toggleParticipant(m.user_id)}
            >
              <MemberAvatar member={m} size={16} maxLetters={1} />
              {m.display_name}
            </button>
          ))}
        </div>
        {canDelete && (
          <p className="mini" style={{ margin: "6px 0 0" }}>
            {t("edit_entry_late_join_note")}
          </p>
        )}
      </div>
      <div className="field">
        <label>{t("field_repeats")}</label>
        <button
          className={`ghost toggle-pill${recurring ? " on" : ""}`}
          style={{ width: "100%" }}
          disabled={!canDelete}
          onClick={() => setRecurring((r) => !r)}
        >
          {recurring && <IconCheck width={14} height={14} />}
          {t(recurring ? "repeat_on" : "repeat_off")}
        </button>
      </div>
      <div className="modal-actions">
        {canDelete ? (
          <>
            <button
              className="danger"
              disabled={submitting}
              onClick={async () => {
                if (submitting) return;
                setSubmitting(true);
                try {
                  await deleteEntry(entryId);
                  onClose();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {t("action_delete")}
            </button>
            <button
              className="primary"
              disabled={submitting}
              onClick={async () => {
                if (submitting) return;
                const a = Number(String(amount).replace(",", "."));
                if (!a || a <= 0) return;
                if (!date) return;
                if (participantIds.size === 0) return;
                setSubmitting(true);
                try {
                  const rounded = Math.round(a * 100) / 100;
                  const patch: {
                    amount: number;
                    note: string;
                    date: string;
                    splitValues?: Record<string, number>;
                    participantIds: string[];
                    recurring: boolean;
                  } = {
                    amount: rounded,
                    note: note.trim(),
                    date,
                    participantIds: [...participantIds],
                    recurring,
                  };
                  // "amounts" splits are absolute values pinned to the old total; rescale them
                  // proportionally so they still add up to the new amount.
                  if (e.split_type === "amounts" && e.amount > 0) {
                    const oldValues = (e.split_values as Record<string, number>) || {};
                    const scale = rounded / e.amount;
                    patch.splitValues = Object.fromEntries(
                      Object.entries(oldValues).map(([id, v]) => [id, Math.round(Number(v) * scale * 100) / 100])
                    );
                  }
                  await updateEntry(entryId, patch);
                  onClose();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {t("action_save")}
            </button>
          </>
        ) : (
          <button className="ghost" onClick={onClose} style={{ gridColumn: "1 / -1" }}>
            {t("action_close")}
          </button>
        )}
      </div>
    </ModalSheet>
  );
}
