"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/ui";
import { useSpace } from "@/lib/store";
import { currentMonth } from "@/lib/domain";
import { money } from "@/lib/format";
import { ModalSheet } from "@/components/ModalSheet";
import { PALETTES, memberVars } from "@/lib/palettes";

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
    default:
      return null;
  }
}

function MonthModal({ onClose }: { onClose: () => void }) {
  const { selectedMonth, setSelectedMonth } = useSpace();
  const [val, setVal] = useState(selectedMonth);
  return (
    <ModalSheet onClose={onClose}>
      <h3>Choose month</h3>
      <p className="sub">Select the month you want to view.</p>
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
  const { members, updateMyMembership, activeSpace, profile } = useSpace();
  const m = members.find((x) => x.id === memberId);
  const canEdit = !!m && !!profile && m.user_id === profile.id;
  const [name, setName] = useState(m?.display_name || "");
  const [palette, setPalette] = useState(m?.palette ?? 0);

  if (!m) return null;

  return (
    <ModalSheet onClose={onClose}>
      <h3>{canEdit ? "Your profile" : m.display_name}</h3>
      <p className="sub">
        {canEdit
          ? "Choose a soft identity color so it's clear who's paying before an expense is added."
          : `Member of ${activeSpace?.name ?? "this space"}. Only they can change their own name and color.`}
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
          {["EUR", "USD", "GBP", "CAD", "AUD", "TRY"].map((c) => (
            <option key={c} value={c}>
              {c}
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
  const { createInvite, activeSpace } = useSpace();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      const c = await createInvite();
      if (!cancelled) {
        setCode(c);
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = code && typeof window !== "undefined" ? `${window.location.origin}/join/${code}` : "";

  return (
    <ModalSheet onClose={onClose}>
      <h3>Invite to {activeSpace?.name}</h3>
      <p className="sub">Anyone with this link can join and see shared expenses. It expires in 14 days.</p>
      {busy ? (
        <div className="empty">Creating invite…</div>
      ) : link ? (
        <>
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
        </>
      ) : (
        <div className="empty">Could not create an invite link.</div>
      )}
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>
          Close
        </button>
        <button
          className="primary"
          disabled={!link}
          onClick={() => {
            navigator.clipboard?.writeText(link).catch(() => {});
          }}
        >
          Copy link
        </button>
      </div>
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
            else setError(res.error || "Invalid invite code");
          }}
        >
          {busy ? "Joining…" : "Join"}
        </button>
      </div>
    </ModalSheet>
  );
}

function EditEntryModal({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const { entries, members, updateEntry, deleteEntry, activeSpace } = useSpace();
  const e = entries.find((x) => x.id === entryId);
  const [amount, setAmount] = useState(e ? String(e.amount) : "");
  const [note, setNote] = useState(e?.note || "");
  const [date, setDate] = useState(e?.entry_date || "");

  if (!e) return null;

  if (e.kind === "settlement") {
    const from = members.find((m) => m.user_id === e.from_id);
    const to = members.find((m) => m.user_id === e.to_id);
    return (
      <ModalSheet onClose={onClose}>
        <h3>Settlement</h3>
        <p className="sub">
          {from?.display_name ?? "Someone"} settled with {to?.display_name ?? "someone"}
        </p>
        <div className="big-money">{money(e.amount, activeSpace?.currency)}</div>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Close
          </button>
          <button
            className="danger"
            onClick={async () => {
              await deleteEntry(entryId);
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </ModalSheet>
    );
  }

  return (
    <ModalSheet onClose={onClose}>
      <h3>Edit entry</h3>
      <div className="field">
        <label>Amount</label>
        <input className="input" inputMode="decimal" value={amount} onChange={(ev) => setAmount(ev.target.value)} />
      </div>
      <div className="field">
        <label>Note</label>
        <input className="input" value={note} onChange={(ev) => setNote(ev.target.value)} />
      </div>
      <div className="field">
        <label>Date</label>
        <input className="input" type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
      </div>
      <div className="modal-actions">
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
            const rounded = Math.round(a * 100) / 100;
            const patch: { amount: number; note: string; date: string; splitValues?: Record<string, number> } = {
              amount: rounded,
              note: note.trim(),
              date,
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
      </div>
    </ModalSheet>
  );
}
