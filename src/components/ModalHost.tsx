"use client";

import { useEffect, useRef, useState } from "react";
import { useUI } from "@/lib/ui";
import { useSpace } from "@/lib/store";
import { useLanguage } from "@/lib/i18n/context";
import { currentMonth, today } from "@/lib/domain";
import { money } from "@/lib/format";
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

// Preview-only: no payment is actually wired up yet. This exists to see how the
// unlock moment (and the thank-you that follows it) looks and feels before
// deciding whether/how to build it for real.
function UnlockModal({ onClose }: { onClose: () => void }) {
  const { activeSpace } = useSpace();
  const [tip, setTip] = useState(0);
  const [stage, setStage] = useState<"offer" | "thanks">("offer");
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const total = 1 + tip;

  if (stage === "thanks") {
    return (
      <ModalSheet onClose={onClose}>
        <div className="hero balanced thanks-card">
          <Confetti pieces={confettiPieces} />
          <div className="thanks-icon">
            <IconHeart width={22} height={22} />
          </div>
          <div className="flow">Thank you</div>
          <div className="hero-text">
            We appreciate your support, and we&apos;re genuinely glad ShareFair has felt good to use.
            {tip > 0 && " Your tip helps support young engineers building things like this."}
          </div>
        </div>
        <div className="modal-actions">
          <button className="primary" style={{ gridColumn: "1 / -1" }} onClick={onClose}>
            Done
          </button>
        </div>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet onClose={onClose}>
      <div className="hero balanced">
        <div className="hero-label">All square</div>
        <div className="flow">
          <IconCheck width={20} height={20} />
          {activeSpace?.name ?? "Your space"} is off to a good start
        </div>
        <div className="hero-text">
          You&apos;ve kept things fair together. A small one-time unlock keeps ShareFair running for
          everyone here.
        </div>
      </div>

      <h3>Unlock {activeSpace?.name ?? "this space"}</h3>
      <p className="sub">One person, one time, everyone in this space — no subscription, no ads, ever.</p>

      <div className="unlock-benefits">
        <div>
          <IconCheck width={15} height={15} />
          Everyone in {activeSpace?.name ?? "this space"} unlocked at once
        </div>
        <div>
          <IconCheck width={15} height={15} />
          Yours forever — pay once, no renewals
        </div>
        <div>
          <IconCheck width={15} height={15} />
          Your history stays, whatever you decide
        </div>
      </div>

      <div className="field">
        <label>Want to support more?</label>
        <div className="chips">
          {TIP_OPTIONS.map((amt) => (
            <button key={amt} className={`chip${tip === amt ? " active" : ""}`} onClick={() => setTip(amt)}>
              {amt === 0 ? "No tip" : `+€${amt}`}
            </button>
          ))}
        </div>
        <p className="mini" style={{ margin: "6px 0 0" }}>
          Optional — a little extra to support young engineers building things like this.
        </p>
      </div>

      <div style={{ textAlign: "center", margin: "14px 0 16px" }}>
        <div className="big-money">€{total}</div>
        <p className="mini">{tip > 0 ? `€1 unlock + €${tip} tip` : "one time, not a subscription"}</p>
      </div>

      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Maybe later
        </button>
        <button
          className="primary green"
          onClick={() => {
            setConfettiPieces(makeConfettiPieces());
            setStage("thanks");
          }}
        >
          Unlock for €{total}
        </button>
      </div>
    </ModalSheet>
  );
}

function ActiveSinceModal({ onClose }: { onClose: () => void }) {
  const { activeSpace, setMyActiveSince } = useSpace();
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
      <h3>Welcome to {activeSpace?.name ?? "the space"}</h3>
      <p className="sub">
        Since when have you been sharing expenses with this group? This just keeps everyone&apos;s
        history accurate — it won&apos;t change anything on its own.
      </p>

      {mode === "choose" ? (
        <div className="modal-actions">
          <button className="ghost" disabled={busy} onClick={() => setMode("date")}>
            Pick a date
          </button>
          <button className="primary" disabled={busy} onClick={() => confirm(today())}>
            From now on
          </button>
        </div>
      ) : (
        <>
          <div className="field">
            <label>Involved since</label>
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
              Back
            </button>
            <button className="primary" disabled={busy || !date} onClick={() => confirm(date)}>
              Confirm
            </button>
          </div>
        </>
      )}
    </ModalSheet>
  );
}

function MonthModal({ onClose }: { onClose: () => void }) {
  const { selectedMonth, setSelectedMonth } = useSpace();
  const [val, setVal] = useState(selectedMonth);
  return (
    <ModalSheet onClose={onClose}>
      <h3>Choose month</h3>
      <p className="sub">Jump to any month to see its activity.</p>
      <div className="field">
        <label>Month</label>
        <input className="input" type="month" value={val} onChange={(e) => setVal(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary"
          onClick={() => {
            setSelectedMonth(val || currentMonth());
            onClose();
          }}
        >
          Use month
        </button>
      </div>
    </ModalSheet>
  );
}

function CategoryManagerModal({ onClose }: { onClose: () => void }) {
  const { categories, addCategory, toggleCategory } = useSpace();
  const [name, setName] = useState("");
  const [housing, setHousing] = useState(false);

  return (
    <ModalSheet onClose={onClose}>
      <h3>Categories</h3>
      <p className="sub">Keep the first screen clean. Hide what you don&apos;t use.</p>
      <div>
        {categories.map((c) => (
          <div className="row" key={c.id}>
            <div>
              <strong>{c.name}</strong>
              <small>
                {c.grp === "housing" ? "Housing" : "Regular"} · {c.active ? "Visible" : "Hidden"}
              </small>
            </div>
            <button className="ghost" onClick={() => toggleCategory(c.id)}>
              {c.active ? "Hide" : "Show"}
            </button>
          </div>
        ))}
      </div>
      <div className="field">
        <label>New category</label>
        <input className="input" placeholder="For example: Plants" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="switch-line">
        <div>
          <strong>Housing category</strong>
          <small className="mini">Excluded when viewing without rent/housing</small>
        </div>
        <label className="switch">
          <input type="checkbox" checked={housing} onChange={(e) => setHousing(e.target.checked)} />
          <span className="track"></span>
        </label>
      </div>
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Done
        </button>
        <button
          className="primary"
          onClick={async () => {
            const trimmed = name.trim();
            if (!trimmed) return;
            await addCategory(trimmed, housing ? "housing" : "daily");
            setName("");
            setHousing(false);
          }}
        >
          Add category
        </button>
      </div>
    </ModalSheet>
  );
}

function EditMemberModal({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const { members, updateMyMembership, setMyActiveSince, profile } = useSpace();
  const m = members.find((x) => x.id === memberId);
  const canEdit = !!m && !!profile && m.user_id === profile.id;
  const [name, setName] = useState(m?.display_name || "");
  const [palette, setPalette] = useState(m?.palette ?? 0);
  const [activeSince, setActiveSince] = useState(m?.active_since || today());

  if (!m) return null;

  return (
    <ModalSheet onClose={onClose}>
      <h3>{canEdit ? "Your profile" : m.display_name}</h3>
      <p className="sub">
        {canEdit
          ? "Pick a color — it helps everyone spot your entries at a glance."
          : `Only ${m.display_name} can change their own name and color.`}
      </p>
      {canEdit ? (
        <>
          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Color palette</label>
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
            <label>Involved since</label>
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
              Cancel
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
              Save
            </button>
          </div>
        </>
      ) : (
        <div className="modal-actions" style={{ gridTemplateColumns: "1fr" }}>
          <button className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </ModalSheet>
  );
}

function NewSpaceModal({ onClose }: { onClose: () => void }) {
  const { createSpace, getPastCollaborators, sendSpaceInvitation } = useSpace();
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
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ModalSheet onClose={onClose}>
      <h3>Join a space</h3>
      <p className="sub">Enter the invite code someone shared with you.</p>
      <div className="field">
        <label>Invite code</label>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. a1b2c3d4" />
      </div>
      {error && (
        <p className="mini" style={{ color: "var(--red)", marginTop: 8 }}>
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Cancel
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
            else setError(res.error || "That invite code doesn't look right");
          }}
        >
          {busy ? "Joining…" : "Join"}
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
