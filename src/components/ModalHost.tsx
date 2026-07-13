"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/ui";
import { useSpace } from "@/lib/store";
import { currentMonth, today } from "@/lib/domain";
import { money, symbol } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";
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
  const { activeSpace } = useSpace();
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
            setConfettiPieces(makeConfettiPieces());
            setStage("thanks");
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
  const { createSpace } = useSpace();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  return (
    <ModalSheet onClose={onClose}>
      <h3>New space</h3>
      <p className="sub">Create a separate shared place for a trip, roommates, or family expenses.</p>
      <div className="field">
        <label>Name</label>
        <input className="input" placeholder="Paris Trip" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Currency</label>
        <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={async () => {
            const trimmed = name.trim();
            if (!trimmed) return;
            await createSpace(trimmed, currency);
            onClose();
          }}
        >
          Create
        </button>
      </div>
    </ModalSheet>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const { createInvite, activeSpace, getPastCollaborators, showToast } = useSpace();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<
    { user_id: string; display_name: string; palette: number }[]
  >([]);

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
    showToast(name ? `Message copied — paste it to invite ${name}` : "Invite message copied");
  }

  return (
    <ModalSheet onClose={onClose}>
      <h3>Invite to {activeSpace?.name}</h3>
      <p className="sub">Anyone with this link can join and see shared expenses. It expires in 14 days.</p>
      {busy ? (
        <div className="empty">Creating invite…</div>
      ) : link ? (
        <>
          {qrDataUrl && (
            <div className="qr-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, not an optimizable remote image */}
              <img src={qrDataUrl} alt="QR code for the invite link" width={168} height={168} />
            </div>
          )}
          <div className="field">
            <label>Invite link</label>
            <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
          <div className="field">
            <label>Or share the code</label>
            <div className="pill" style={{ justifyContent: "flex-start", fontSize: 18, letterSpacing: "0.08em" }}>
              {code}
            </div>
          </div>
          {collaborators.length > 0 && (
            <div className="field">
              <label>People you&apos;ve shared spaces with</label>
              <div className="chips">
                {collaborators.map((p) => (
                  <button
                    key={p.user_id}
                    className="chip person-chip"
                    style={memberVars(p.palette)}
                    onClick={() => share(p.display_name)}
                  >
                    <MemberAvatar member={p} size={16} maxLetters={1} />
                    {p.display_name}
                  </button>
                ))}
              </div>
              <p className="mini" style={{ margin: "6px 0 0" }}>
                Tap someone to share this invite with them directly — they still need to open it to join.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="empty">Could not create an invite link.</div>
      )}
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Close
        </button>
        <button className="primary" disabled={!link} onClick={() => share()}>
          Share
        </button>
      </div>
      {link && (
        <button
          className="link"
          style={{ width: "100%", marginTop: 10, textAlign: "center" }}
          onClick={() => {
            navigator.clipboard?.writeText(link).catch(() => {});
            showToast("Link copied");
          }}
        >
          Copy link instead
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
  const e = entries.find((x) => x.id === entryId);
  const [amount, setAmount] = useState(e ? String(e.amount) : "");
  const [note, setNote] = useState(e?.note || "");
  const [date, setDate] = useState(e?.entry_date || "");
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set(e?.participant_ids ?? []));
  const [recurring, setRecurring] = useState(e?.recurring ?? false);

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

    if (e.status === "pending") {
      const iAmConfirmer = profile?.id !== e.created_by && (profile?.id === e.from_id || profile?.id === e.to_id);
      const iAmInitiator = profile?.id === e.created_by;
      return (
        <ModalSheet onClose={onClose}>
          <h3>Settlement — awaiting confirmation</h3>
          <p className="sub">
            {from?.display_name ?? "Someone"} → {to?.display_name ?? "someone"}
          </p>
          <div className="big-money">{money(e.amount, activeSpace?.currency)}</div>
          {iAmConfirmer ? (
            <>
              <p className="mini" style={{ margin: "0 0 14px" }}>
                Confirm this actually happened before it counts toward balances.
              </p>
              <div className="modal-actions">
                <button
                  className="ghost"
                  onClick={async () => {
                    await declineSettlement(entryId);
                    onClose();
                  }}
                >
                  Decline
                </button>
                <button
                  className="primary green"
                  onClick={async () => {
                    await confirmSettlement(entryId);
                    onClose();
                  }}
                >
                  Confirm
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
                Close
              </button>
              {iAmInitiator && (
                <button
                  className="danger"
                  onClick={async () => {
                    await declineSettlement(entryId);
                    onClose();
                  }}
                >
                  Cancel request
                </button>
              )}
            </div>
          )}
        </ModalSheet>
      );
    }

    return (
      <ModalSheet onClose={onClose}>
        <h3>Settlement</h3>
        <p className="sub">
          {from?.display_name ?? "Someone"} settled with {to?.display_name ?? "someone"}
        </p>
        <div className="big-money">{money(e.amount, activeSpace?.currency)}</div>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose} style={canDelete ? undefined : { gridColumn: "1 / -1" }}>
            Close
          </button>
          {canDelete && (
            <button
              className="danger"
              onClick={async () => {
                await deleteEntry(entryId);
                onClose();
              }}
            >
              Delete
            </button>
          )}
        </div>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet onClose={onClose}>
      <h3>Edit entry</h3>
      {!canDelete && (
        <p className="sub">Only whoever added this, or the space owner, can change it — you can still see it.</p>
      )}
      <div className="field">
        <label>Amount</label>
        <input
          className="input"
          inputMode="decimal"
          value={amount}
          disabled={!canDelete}
          onChange={(ev) => setAmount(ev.target.value)}
        />
      </div>
      <div className="field">
        <label>Note</label>
        <input className="input" value={note} disabled={!canDelete} onChange={(ev) => setNote(ev.target.value)} />
      </div>
      <div className="field">
        <label>Date</label>
        <input
          className="input"
          type="date"
          value={date}
          disabled={!canDelete}
          onChange={(ev) => setDate(ev.target.value)}
        />
      </div>
      <div className="field">
        <label>Shared by</label>
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
            Someone who joined later? Add them here to fold this expense into their balance too.
          </p>
        )}
      </div>
      <div className="field">
        <label>Repeats</label>
        <button
          className={`ghost toggle-pill${recurring ? " on" : ""}`}
          style={{ width: "100%" }}
          disabled={!canDelete}
          onClick={() => setRecurring((r) => !r)}
        >
          {recurring && <IconCheck width={14} height={14} />}
          {recurring ? "Repeats monthly" : "No repeat"}
        </button>
      </div>
      <div className="modal-actions">
        {canDelete ? (
          <>
            <button
              className="danger"
              onClick={async () => {
                await deleteEntry(entryId);
                onClose();
              }}
            >
              Delete
            </button>
            <button
              className="primary"
              onClick={async () => {
                const a = Number(String(amount).replace(",", "."));
                if (!a || a <= 0) return;
                if (!date) return;
                if (participantIds.size === 0) return;
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
              }}
            >
              Save
            </button>
          </>
        ) : (
          <button className="ghost" onClick={onClose} style={{ gridColumn: "1 / -1" }}>
            Close
          </button>
        )}
      </div>
    </ModalSheet>
  );
}
