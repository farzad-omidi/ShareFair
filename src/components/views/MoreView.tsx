"use client";

import { useSpace } from "@/lib/store";
import { useUI } from "@/lib/ui";
import { memberVars, paletteFor } from "@/lib/palettes";

export function MoreView() {
  const { spaces, activeSpaceId, switchSpace, members, profile, userEmail, entries, categories, activeSpace, signOut } =
    useSpace();
  const { openModal } = useUI();

  function exportCsv() {
    const rows: string[][] = [
      ["date", "month", "kind", "payer/from", "to", "category", "amount", "currency", "note"],
    ];
    const memberName = (id: string | null) => members.find((m) => m.user_id === id)?.display_name ?? "";
    const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";
    entries.forEach((e) => {
      rows.push([
        e.entry_date,
        e.month,
        e.kind,
        e.kind === "settlement" ? memberName(e.from_id) : memberName(e.payer_id),
        e.kind === "settlement" ? memberName(e.to_id) : "",
        e.kind === "settlement" ? "Settlement" : catName(e.category_id),
        String(e.amount),
        activeSpace?.currency ?? "",
        e.note ?? "",
      ]);
    });
    // Guard against CSV formula injection: a cell starting with =/+/-/@ can execute as a
    // formula when the file is opened in Excel/Sheets.
    const csvSafe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
    const csv = rows
      .map((r) => r.map((v) => `"${csvSafe(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSpace?.name ?? "sharefair"}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
              <span className="mini-dot" style={memberVars(m.palette)}></span>
              <div>
                <strong>{m.display_name}</strong>
                <small>
                  {paletteFor(m.palette).name} palette{m.user_id === profile?.id ? " · you" : ""}
                </small>
              </div>
            </div>
            {m.user_id === profile?.id && (
              <button className="ghost" onClick={() => openModal({ type: "editMember", memberId: m.id })}>
                Edit
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">
          <div>
            <h2>Backup</h2>
            <p>Export a copy of this space&apos;s entries.</p>
          </div>
        </div>
        <button className="ghost" style={{ width: "100%" }} onClick={exportCsv}>
          Export CSV
        </button>
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
