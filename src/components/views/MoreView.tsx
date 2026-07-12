"use client";

import { useRef } from "react";
import { useSpace, type ImportRow } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { paletteFor } from "@/lib/palettes";
import { MemberAvatar } from "@/components/Avatar";
import { toCsvRow, parseCsv } from "@/lib/csv";
import type { SplitType } from "@/lib/types";

const CSV_HEADER = [
  "date",
  "kind",
  "payer/from",
  "to",
  "category",
  "amount",
  "note",
  "participants",
  "split_type",
  "split_values",
  "recurring",
];

export function MoreView() {
  const {
    spaces,
    activeSpaceId,
    switchSpace,
    members,
    profile,
    userEmail,
    entries,
    categories,
    activeSpace,
    removeMember,
    importEntries,
    showToast,
    signOut,
  } = useSpace();
  const { openModal } = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const myMember = members.find((m) => m.user_id === profile?.id);
  const isOwner = myMember?.role === "owner";

  function exportCsv() {
    const memberName = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? "";
    const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";
    const rows: string[][] = [CSV_HEADER];
    entries.forEach((e) => {
      if (e.kind === "request") return;
      const participantNames = (e.participant_ids || []).map(memberName).filter(Boolean).join(";");
      const splitValues = (e.split_values as Record<string, number>) || {};
      const splitValuesByName = Object.fromEntries(
        Object.entries(splitValues).map(([id, v]) => [memberName(id), v])
      );
      rows.push([
        e.entry_date,
        e.kind,
        e.kind === "settlement" ? memberName(e.from_id) : memberName(e.payer_id),
        e.kind === "settlement" ? memberName(e.to_id) : "",
        e.kind === "settlement" ? "" : catName(e.category_id),
        String(e.amount),
        e.note ?? "",
        e.kind === "settlement" ? "" : participantNames,
        e.kind === "settlement" ? "" : e.split_type,
        e.kind === "settlement" || Object.keys(splitValuesByName).length === 0
          ? ""
          : JSON.stringify(splitValuesByName),
        String(e.recurring),
      ]);
    });
    const csv = rows.map(toCsvRow).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSpace?.name ?? "sharefair"}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      showToast("That file doesn't look like a ShareFair export");
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name: string) => header.indexOf(name);
    const dateI = col("date");
    const kindI = col("kind");
    const fromI = col("payer/from");
    const toI = col("to");
    const catI = col("category");
    const amtI = col("amount");
    const noteI = col("note");
    const partI = col("participants");
    const splitTypeI = col("split_type");
    const splitValI = col("split_values");
    const recI = col("recurring");
    if (dateI < 0 || kindI < 0 || fromI < 0 || amtI < 0) {
      showToast("That file doesn't look like a ShareFair export");
      return;
    }

    const parsed: ImportRow[] = rows.slice(1).map((r) => {
      let splitValues: Record<string, number> = {};
      if (splitValI >= 0 && r[splitValI]) {
        try {
          splitValues = JSON.parse(r[splitValI]);
        } catch {
          splitValues = {};
        }
      }
      return {
        date: (r[dateI] || "").trim(),
        kind: (r[kindI] || "").trim() as ImportRow["kind"],
        payerOrFromName: r[fromI] || "",
        toName: toI >= 0 ? r[toI] || "" : "",
        categoryName: catI >= 0 ? r[catI] || "" : "",
        amount: Number(r[amtI]),
        note: noteI >= 0 ? r[noteI] || "" : "",
        participantNames:
          partI >= 0 && r[partI]
            ? r[partI]
                .split(";")
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        splitType: (splitTypeI >= 0 && r[splitTypeI] ? r[splitTypeI] : "equal") as SplitType,
        splitValues,
        recurring: recI >= 0 && r[recI]?.trim().toLowerCase() === "true",
      };
    });

    await importEntries(parsed);
  }

  return (
    <>
      <div className="card">
        <div className="card-title">
          <div>
            <h2>Spaces</h2>
            <p>Use one app for home, trips, roommates, or family expenses.</p>
          </div>
          <button className="link" onClick={() => openModal({ type: "newSpace" })}>
            New
          </button>
        </div>
        {spaces.map((sp) => (
          <div className="row" key={sp.id}>
            <div>
              <strong>{sp.name}</strong>
              <small>{sp.currency}</small>
            </div>
            <button className="ghost" onClick={() => switchSpace(sp.id)}>
              {sp.id === activeSpaceId ? "Active" : "Open"}
            </button>
          </div>
        ))}
        <button className="ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => openModal({ type: "joinSpace" })}>
          Join with a code
        </button>
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>Members</h2>
            <p>Invite people to your current space.</p>
          </div>
          <button className="link" onClick={() => openModal({ type: "invite" })}>
            Invite
          </button>
        </div>
        {members.map((m) => (
          <div className="row" key={m.id}>
            <div className="member-name-line" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MemberAvatar member={m} size={26} />
              <div>
                <strong>{m.display_name}</strong>
                <small>
                  {paletteFor(m.palette).name} palette{m.user_id === profile?.id ? " · you" : ""}
                  {m.role === "owner" ? " · owner" : ""}
                </small>
              </div>
            </div>
            {m.user_id === profile?.id ? (
              <button className="ghost" onClick={() => openModal({ type: "editMember", memberId: m.id })}>
                Edit
              </button>
            ) : (
              isOwner && (
                <button
                  className="ghost"
                  onClick={() => {
                    if (window.confirm(`Remove ${m.display_name} from this space?`)) removeMember(m.id);
                  }}
                >
                  Remove
                </button>
              )
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>Backup</h2>
            <p>Export a copy of this space&apos;s entries, or bring one back in.</p>
          </div>
        </div>
        <div className="grid2">
          <button className="ghost" onClick={exportCsv}>
            Export CSV
          </button>
          <button className="ghost" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={async (ev) => {
            const file = ev.target.files?.[0];
            ev.target.value = "";
            if (file) await handleImportFile(file);
          }}
        />
        <p className="mini" style={{ margin: "10px 0 0" }}>
          Import only understands CSV files exported from ShareFair — names are matched
          against this space&apos;s current members and categories.
        </p>
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>Account</h2>
            <p>{userEmail}</p>
          </div>
        </div>
        <button className="danger" style={{ width: "100%" }} onClick={signOut}>
          Sign out
        </button>
      </div>
    </>
  );
}
