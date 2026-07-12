"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { currentMonth, today, monthKey } from "@/lib/domain";
import type { Category, EntryRow, Profile, Space, SpaceMember, SplitType } from "@/lib/types";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";

type NewEntryInput = {
  kind: "expense" | "credit";
  payerId: string;
  categoryId: string;
  amount: number;
  date: string;
  note: string;
  participantIds: string[];
  splitType: SplitType;
  splitValues: Record<string, number>;
  recurring: boolean;
};

// Names, not ids -- resolved against the current space's members/categories inside
// importEntries, since a backup file has to survive being made on one device and
// restored (or shared) on another where ids don't necessarily line up.
export type ImportRow = {
  date: string;
  kind: "expense" | "credit" | "settlement";
  payerOrFromName: string;
  toName: string;
  categoryName: string;
  amount: number;
  note: string;
  participantNames: string[];
  splitType: SplitType;
  splitValues: Record<string, number>;
  recurring: boolean;
};

type SpaceContextValue = {
  loading: boolean;
  userEmail: string;
  profile: Profile | null;
  spaces: Space[];
  activeSpaceId: string | null;
  activeSpace: Space | null;
  members: SpaceMember[];
  categories: Category[];
  entries: EntryRow[];
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  toast: string | null;
  showToast: (msg: string) => void;
  realtimeStatus: "connecting" | "live" | "offline";

  switchSpace: (id: string) => void;
  createSpace: (name: string, currency: string) => Promise<void>;
  joinSpaceByCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  createInvite: () => Promise<string | null>;
  getPastCollaborators: () => Promise<{ user_id: string; display_name: string; palette: number }[]>;

  addEntry: (input: NewEntryInput) => Promise<void>;
  updateEntry: (
    id: string,
    patch: {
      amount?: number;
      note?: string;
      date?: string;
      splitValues?: Record<string, number>;
      participantIds?: string[];
      recurring?: boolean;
    }
  ) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  settle: (fromId: string, toId: string, amount: number) => Promise<void>;
  confirmSettlement: (id: string) => Promise<void>;
  declineSettlement: (id: string) => Promise<void>;
  requestPayment: (fromId: string, toId: string, amount: number) => Promise<void>;
  cancelRequest: (id: string) => Promise<void>;
  importEntries: (rows: ImportRow[]) => Promise<{ imported: number; skipped: number }>;

  addCategory: (name: string, grp: "daily" | "housing") => Promise<void>;
  toggleCategory: (id: string) => Promise<void>;

  updateMyMembership: (displayName: string, palette: number) => Promise<void>;
  updateMyProfile: (displayName: string, palette: number) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;

  signOut: () => Promise<void>;
};

const SpaceContext = createContext<SpaceContextValue | null>(null);

export function useSpace() {
  const ctx = useContext(SpaceContext);
  if (!ctx) throw new Error("useSpace must be used within SpaceProvider");
  return ctx;
}

export const ACTIVE_SPACE_STORAGE_KEY = "sharefair.activeSpaceId";

export function SpaceProvider({
  userId,
  userEmail,
  children,
}: {
  userId: string;
  userEmail: string;
  children: ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "offline">("connecting");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data);
  }, [supabase, userId]);

  const loadSpaces = useCallback(async () => {
    const { data } = await supabase
      .from("space_members")
      .select("space:spaces(*)")
      .eq("user_id", userId);
    const list = (data ?? [])
      .map((r) => r.space)
      .filter((s): s is Space => !!s)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    setSpaces(list);
    return list;
  }, [supabase, userId]);

  const loadSpaceData = useCallback(
    async (spaceId: string) => {
      const [membersRes, categoriesRes, entriesRes] = await Promise.all([
        supabase.from("space_members").select("*").eq("space_id", spaceId).order("joined_at"),
        supabase.from("categories").select("*").eq("space_id", spaceId).order("sort_order"),
        supabase.from("entries").select("*").eq("space_id", spaceId).order("entry_date", { ascending: false }),
      ]);
      setMembers(membersRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
      setEntries(entriesRes.data ?? []);
    },
    [supabase]
  );

  // initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadProfile();
      const list = await loadSpaces();
      if (cancelled) return;
      const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_SPACE_STORAGE_KEY) : null;
      const initial = list.find((s) => s.id === stored)?.id ?? list[0]?.id ?? null;
      setActiveSpaceId(initial);
      if (initial) await loadSpaceData(initial);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchSpace = useCallback(
    (id: string) => {
      setActiveSpaceId(id);
      setSelectedMonth(currentMonth());
      setRealtimeStatus("connecting");
      if (typeof window !== "undefined") localStorage.setItem(ACTIVE_SPACE_STORAGE_KEY, id);
      loadSpaceData(id);
    },
    [loadSpaceData]
  );

  // realtime subscription for the active space
  useEffect(() => {
    if (!activeSpaceId) return;
    const channel = supabase
      .channel(`space-${activeSpaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entries", filter: `space_id=eq.${activeSpaceId}` },
        () => loadSpaceData(activeSpaceId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "space_members", filter: `space_id=eq.${activeSpaceId}` },
        () => loadSpaceData(activeSpaceId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories", filter: `space_id=eq.${activeSpaceId}` },
        () => loadSpaceData(activeSpaceId)
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeStatus("offline");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSpaceId, supabase, loadSpaceData]);

  const createSpace = useCallback(
    async (name: string, currency: string) => {
      const { data, error } = await supabase.rpc("create_space", { p_name: name, p_currency: currency });
      if (error || !data) {
        showToast("Couldn't create the space — nothing was saved, try again");
        return;
      }
      await loadSpaces();
      switchSpace(data);
      showToast("Space created");
    },
    [supabase, loadSpaces, switchSpace, showToast]
  );

  const joinSpaceByCode = useCallback(
    async (code: string) => {
      const { data, error } = await supabase.rpc("redeem_invite", { p_code: code.trim() });
      if (error || !data) {
        return { ok: false, error: error?.message || "That invite code doesn't look right" };
      }
      await loadSpaces();
      switchSpace(data);
      showToast("Joined space");
      return { ok: true };
    },
    [supabase, loadSpaces, switchSpace, showToast]
  );

  const createInvite = useCallback(async () => {
    if (!activeSpaceId) return null;
    const { data, error } = await supabase.rpc("create_invite", { p_space_id: activeSpaceId });
    if (error || !data) {
      showToast("Couldn't create an invite link — try again in a moment");
      return null;
    }
    return data;
  }, [supabase, activeSpaceId, showToast]);

  // People you've shared any other space with, minus whoever's already in the
  // current one -- a shortcut for who to send this invite to, not a way to add
  // them directly (joining still always requires them to redeem the invite).
  const getPastCollaborators = useCallback(async () => {
    if (spaces.length === 0) return [];
    const spaceIds = spaces.map((s) => s.id);
    const { data, error } = await supabase
      .from("space_members")
      .select("user_id, display_name, palette")
      .in("space_id", spaceIds)
      .neq("user_id", userId);
    if (error || !data) return [];
    const currentIds = new Set(members.map((m) => m.user_id));
    const seen = new Map<string, { user_id: string; display_name: string; palette: number }>();
    data.forEach((m) => {
      if (currentIds.has(m.user_id) || seen.has(m.user_id)) return;
      seen.set(m.user_id, m);
    });
    return [...seen.values()];
  }, [supabase, spaces, members, userId]);

  const addEntry = useCallback(
    async (input: NewEntryInput) => {
      if (!activeSpaceId) return;
      const { error } = await supabase.from("entries").insert({
        space_id: activeSpaceId,
        kind: input.kind,
        payer_id: input.payerId,
        category_id: input.categoryId,
        amount: input.amount,
        entry_date: input.date,
        month: monthKey(input.date),
        note: input.note || null,
        participant_ids: input.participantIds,
        split_type: input.splitType,
        split_values: input.splitValues,
        recurring: input.recurring,
        created_by: userId,
      });
      if (error) {
        showToast("Couldn't add that — nothing was saved, try again");
        return;
      }
      setSelectedMonth(monthKey(input.date));
      showToast(input.kind === "credit" ? "Credit added" : "Expense added");
      loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, userId, showToast, loadSpaceData]
  );

  const updateEntry = useCallback(
    async (
      id: string,
      patch: {
        amount?: number;
        note?: string;
        date?: string;
        splitValues?: Record<string, number>;
        participantIds?: string[];
      }
    ) => {
      const { splitValues, date, participantIds, ...rest } = patch;
      const dbPatch: TablesUpdate<"entries"> = { ...rest };
      if (splitValues) dbPatch.split_values = splitValues;
      if (participantIds) dbPatch.participant_ids = participantIds;
      if (date) {
        dbPatch.entry_date = date;
        dbPatch.month = monthKey(date);
      }
      const { error } = await supabase.from("entries").update(dbPatch).eq("id", id);
      if (error) {
        showToast("Couldn't save those changes — the entry is unchanged, try again");
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) {
        showToast("Couldn't delete that entry — it's still there, try again");
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast]
  );

  const settle = useCallback(
    async (fromId: string, toId: string, amount: number) => {
      if (!activeSpaceId) return;
      const { error } = await supabase.from("entries").insert({
        space_id: activeSpaceId,
        kind: "settlement",
        from_id: fromId,
        to_id: toId,
        amount,
        entry_date: today(),
        month: selectedMonth,
        participant_ids: [],
        created_by: userId,
        status: "pending",
      });
      if (error) {
        showToast("Couldn't mark that settled — nothing changed, try again");
        return;
      }
      // A payment request for this pair is moot once payment is actually underway.
      await supabase
        .from("entries")
        .delete()
        .match({ space_id: activeSpaceId, kind: "request", from_id: fromId, to_id: toId });
      showToast("Sent — waiting for them to confirm");
      loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, userId, selectedMonth, showToast, loadSpaceData]
  );

  const confirmSettlement = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("entries").update({ status: "confirmed" }).eq("id", id);
      if (error) {
        showToast("Couldn't confirm that — try again");
        return;
      }
      showToast("Settled up — all square now");
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast]
  );

  const declineSettlement = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) {
        showToast("Couldn't decline that — try again");
        return;
      }
      showToast("Declined — the balance is still open");
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast]
  );

  const requestPayment = useCallback(
    async (fromId: string, toId: string, amount: number) => {
      if (!activeSpaceId) return;
      const { error } = await supabase.from("entries").insert({
        space_id: activeSpaceId,
        kind: "request",
        from_id: fromId,
        to_id: toId,
        amount,
        entry_date: today(),
        month: selectedMonth,
        participant_ids: [],
        created_by: userId,
      });
      if (error) {
        showToast("Couldn't send that request — try again");
        return;
      }
      showToast("Payment request sent");
      loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, userId, selectedMonth, showToast, loadSpaceData]
  );

  const cancelRequest = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) {
        showToast("Couldn't remove that — try again");
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast]
  );

  const importEntries = useCallback(
    async (rows: ImportRow[]) => {
      if (!activeSpaceId) return { imported: 0, skipped: rows.length };

      const nameToId = new Map(members.map((m) => [m.display_name.trim().toLowerCase(), m.user_id]));
      const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

      // Create whatever categories the file references that this space doesn't have yet,
      // before inserting entries so every row can be assigned a real category_id.
      const neededCatNames = [
        ...new Set(
          rows
            .filter((r) => r.kind !== "settlement" && r.categoryName.trim())
            .map((r) => r.categoryName.trim())
            .filter((n) => !catByName.has(n.toLowerCase()))
        ),
      ];
      let sortOrder = categories.length ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;
      for (const name of neededCatNames) {
        const { data } = await supabase
          .from("categories")
          .insert({ space_id: activeSpaceId, name, grp: "daily", sort_order: sortOrder++ })
          .select()
          .single();
        if (data) catByName.set(name.toLowerCase(), data.id);
      }

      const toInsert: TablesInsert<"entries">[] = [];
      let skipped = 0;
      rows.forEach((r) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(r.amount) || r.amount <= 0) {
          skipped++;
          return;
        }
        if (r.kind === "settlement") {
          const fromId = nameToId.get(r.payerOrFromName.trim().toLowerCase());
          const toId = nameToId.get(r.toName.trim().toLowerCase());
          if (!fromId || !toId) {
            skipped++;
            return;
          }
          toInsert.push({
            space_id: activeSpaceId,
            kind: "settlement",
            from_id: fromId,
            to_id: toId,
            amount: r.amount,
            entry_date: r.date,
            month: monthKey(r.date),
            participant_ids: [],
            created_by: userId,
          });
          return;
        }
        const payerId = nameToId.get(r.payerOrFromName.trim().toLowerCase());
        if (!payerId) {
          skipped++;
          return;
        }
        const categoryId = r.categoryName.trim() ? catByName.get(r.categoryName.trim().toLowerCase()) : undefined;
        const participantIds = r.participantNames.length
          ? r.participantNames.map((n) => nameToId.get(n.trim().toLowerCase())).filter((id): id is string => !!id)
          : members.map((m) => m.user_id);
        if (participantIds.length === 0) {
          skipped++;
          return;
        }
        const splitValues: Record<string, number> = {};
        Object.entries(r.splitValues).forEach(([name, v]) => {
          const id = nameToId.get(name.trim().toLowerCase());
          if (id) splitValues[id] = v;
        });
        toInsert.push({
          space_id: activeSpaceId,
          kind: r.kind,
          payer_id: payerId,
          category_id: categoryId ?? null,
          amount: r.amount,
          entry_date: r.date,
          month: monthKey(r.date),
          note: r.note || null,
          participant_ids: participantIds,
          split_type: r.splitType,
          split_values: splitValues,
          recurring: r.recurring,
          created_by: userId,
        });
      });

      if (toInsert.length === 0) {
        showToast("Nothing to import — check the file and try again");
        return { imported: 0, skipped };
      }
      const { error } = await supabase.from("entries").insert(toInsert);
      if (error) {
        showToast("Import failed — nothing was added, try again");
        return { imported: 0, skipped: rows.length };
      }
      showToast(
        skipped > 0
          ? `Imported ${toInsert.length}, skipped ${skipped} we couldn't match`
          : `Imported ${toInsert.length} ${toInsert.length === 1 ? "entry" : "entries"}`
      );
      loadSpaceData(activeSpaceId);
      return { imported: toInsert.length, skipped };
    },
    [supabase, activeSpaceId, members, categories, userId, loadSpaceData, showToast]
  );

  const addCategory = useCallback(
    async (name: string, grp: "daily" | "housing") => {
      if (!activeSpaceId) return;
      const sortOrder = categories.length ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;
      const { error } = await supabase
        .from("categories")
        .insert({ space_id: activeSpaceId, name, grp, sort_order: sortOrder });
      if (error) {
        showToast("Couldn't add that category — try again");
        return;
      }
      loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, categories, loadSpaceData, showToast]
  );

  const toggleCategory = useCallback(
    async (id: string) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return;
      const { error } = await supabase.from("categories").update({ active: !cat.active }).eq("id", id);
      if (error) return;
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, categories, activeSpaceId, loadSpaceData]
  );

  const updateMyMembership = useCallback(
    async (displayName: string, palette: number) => {
      const mine = members.find((m) => m.user_id === userId);
      if (!mine) return;
      const { error } = await supabase
        .from("space_members")
        .update({ display_name: displayName, palette })
        .eq("id", mine.id);
      if (error) {
        showToast("Couldn't save your profile — try again");
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, members, userId, activeSpaceId, loadSpaceData, showToast]
  );

  const updateMyProfile = useCallback(
    async (displayName: string, palette: number) => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName, palette })
        .eq("id", userId);
      if (error) return;
      await loadProfile();
    },
    [supabase, userId, loadProfile]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      const { error } = await supabase.from("space_members").delete().eq("id", memberId);
      if (error) {
        showToast("Couldn't remove that member — try again");
        return;
      }
      showToast("Member removed");
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, [supabase]);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null;

  const value: SpaceContextValue = {
    loading,
    userEmail,
    profile,
    spaces,
    activeSpaceId,
    activeSpace,
    members,
    categories,
    entries,
    selectedMonth,
    setSelectedMonth,
    toast,
    showToast,
    realtimeStatus,
    switchSpace,
    createSpace,
    joinSpaceByCode,
    createInvite,
    getPastCollaborators,
    addEntry,
    updateEntry,
    deleteEntry,
    settle,
    confirmSettlement,
    declineSettlement,
    requestPayment,
    cancelRequest,
    importEntries,
    addCategory,
    toggleCategory,
    updateMyMembership,
    updateMyProfile,
    removeMember,
    signOut,
  };

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}
