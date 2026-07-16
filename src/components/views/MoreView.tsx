"use client";

import { useRef, useState } from "react";
import { useSpace, type ImportRow } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { useLanguage } from "@/lib/i18n/context";
import { LANGUAGES } from "@/lib/i18n/languages";
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
    myInvitations,
    respondToInvitation,
    deleteSpace,
  } = useSpace();
  const { openModal } = useUI();
  const { t, language, setLanguage } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const myMember = members.find((m) => m.user_id === profile?.id);
  const isOwner = myMember?.role === "owner";
  const [openSection, setOpenSection] = useState<"spaces" | "members" | "language" | null>("spaces");

  function toggleSection(section: "spaces" | "members" | "language") {
    setOpenSection((current) => (current === section ? null : section));
  }

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
      showToast(t("more_import_bad_file_toast"));
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
      showToast(t("more_import_bad_file_toast"));
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
      {myInvitations.length > 0 && (
        <div className="card">
          <div className="card-title">
            <div>
              <h2>{t("more_invites_card_title")}</h2>
              <p>{t("more_invites_card_subtitle")}</p>
            </div>
          </div>
          {myInvitations.map((inv) => (
            <div className="debt-row" key={inv.id}>
              <div className="top">
                <div>
                  <strong>{inv.space_name}</strong>
                  <small>{t("more_invite_from", { name: inv.invited_by_name })}</small>
                </div>
              </div>
              <div className="grid2">
                <button className="ghost" onClick={() => respondToInvitation(inv.id, false)}>
                  {t("action_decline")}
                </button>
                <button className="primary green" onClick={() => respondToInvitation(inv.id, true)}>
                  {t("action_confirm")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <button
          type="button"
          className="accordion-toggle card-title"
          aria-expanded={openSection === "spaces"}
          onClick={() => toggleSection("spaces")}
        >
          <div>
            <h2>{t("spaces_card_title")}</h2>
            <p>{t("spaces_card_subtitle")}</p>
          </div>
          <span className="accordion-chevron">⌄</span>
        </button>
        <div className={`accordion-body-wrap${openSection === "spaces" ? " open" : ""}`}>
          <div className="accordion-body">
            <button className="link" style={{ marginBottom: 12 }} onClick={() => openModal({ type: "newSpace" })}>
              {t("spaces_new_btn")}
            </button>
            {spaces.map((sp) => (
              <div className="row" key={sp.id}>
                <div>
                  <strong>{sp.name}</strong>
                  <small>{sp.currency}</small>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="ghost" onClick={() => switchSpace(sp.id)}>
                    {sp.id === activeSpaceId ? t("spaces_active_btn") : t("spaces_open_btn")}
                  </button>
                  {sp.created_by === profile?.id && (
                    <button
                      className="ghost"
                      onClick={() => {
                        if (window.confirm(t("spaces_confirm_delete", { name: sp.name }))) deleteSpace(sp.id);
                      }}
                    >
                      {t("action_delete")}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button className="ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => openModal({ type: "joinSpace" })}>
              {t("spaces_join_code_btn")}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <button
          type="button"
          className="accordion-toggle card-title"
          aria-expanded={openSection === "members"}
          onClick={() => toggleSection("members")}
        >
          <div>
            <h2>{t("members_card_title")}</h2>
            <p>{t("members_card_subtitle")}</p>
          </div>
          <span className="accordion-chevron">⌄</span>
        </button>
        <div className={`accordion-body-wrap${openSection === "members" ? " open" : ""}`}>
          <div className="accordion-body">
            <button className="link" style={{ marginBottom: 12 }} onClick={() => openModal({ type: "invite" })}>
              {t("members_invite_btn")}
            </button>
            {members.map((m) => (
              <div className="row" key={m.id}>
                <div className="member-name-line" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MemberAvatar member={m} size={26} />
                  <div>
                    <strong>{m.display_name}</strong>
                    <small>
                      {t("more_palette_suffix", { palette: paletteFor(m.palette).name })}
                      {m.user_id === profile?.id ? t("more_you_suffix") : ""}
                      {m.role === "owner" ? t("more_owner_suffix") : ""}
                    </small>
                  </div>
                </div>
                {m.user_id === profile?.id ? (
                  <button className="ghost" onClick={() => openModal({ type: "editMember", memberId: m.id })}>
                    {t("action_edit")}
                  </button>
                ) : (
                  isOwner && (
                    <button
                      className="ghost"
                      onClick={() => {
                        if (window.confirm(t("more_confirm_remove_member", { name: m.display_name }))) removeMember(m.id);
                      }}
                    >
                      {t("action_delete")}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <button
          type="button"
          className="accordion-toggle card-title"
          aria-expanded={openSection === "language"}
          onClick={() => toggleSection("language")}
        >
          <div>
            <h2>{t("language_card_title")}</h2>
            <p>{t("language_card_subtitle")}</p>
          </div>
          <span className="accordion-chevron">⌄</span>
        </button>
        <div className={`accordion-body-wrap${openSection === "language" ? " open" : ""}`}>
          <div className="accordion-body">
            <div className="chips">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  className={`chip${language === l.code ? " active" : ""}`}
                  onClick={() => setLanguage(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>{t("backup_card_title")}</h2>
            <p>{t("backup_card_subtitle")}</p>
          </div>
        </div>
        <div className="grid2">
          <button className="ghost" onClick={exportCsv}>
            {t("backup_export_btn")}
          </button>
          <button className="ghost" onClick={() => fileInputRef.current?.click()}>
            {t("backup_import_btn")}
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
          {t("more_import_mini")}
        </p>
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>{t("unlock_card_title")}</h2>
            <p>{t("more_unlock_preview_subtitle")}</p>
          </div>
        </div>
        <button className="ghost" style={{ width: "100%" }} onClick={() => openModal({ type: "unlock" })}>
          {t("more_preview_unlock_btn")}
        </button>
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>{t("account_card_title")}</h2>
            <p>{userEmail}</p>
          </div>
        </div>
        <button className="danger" style={{ width: "100%" }} onClick={signOut}>
          {t("account_signout_btn")}
        </button>
      </div>
    </>
  );
}
