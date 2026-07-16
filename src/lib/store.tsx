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
import { currentMonth, today, monthKey, calcThrough } from "@/lib/domain";
import { useLanguage } from "@/lib/i18n/context";
import { makeConfettiPieces, type ConfettiPiece } from "@/components/Confetti";
import type { Category, EntryRow, MyInvitation, Profile, Space, SpaceMember, SplitType } from "@/lib/types";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";

// A sentinel month far beyond any real entry, used with calcThrough to get a
// member's all-time balance (rather than a balance through some specific month).
const FAR_FUTURE_MONTH = "9999-12";

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
  celebration: ConfettiPiece[];
  realtimeStatus: "connecting" | "live" | "offline";

  switchSpace: (id: string) => void;
  deleteSpace: (spaceId: string) => Promise<void>;
  createSpace: (name: string, currency: string) => Promise<string | null>;
  joinSpaceByCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  createInvite: () => Promise<string | null>;
  getPastCollaborators: (
    forSpaceId?: string
  ) => Promise<{ user_id: string; display_name: string; palette: number }[]>;
  sendSpaceInvitation: (spaceId: string, invitedUserId: string) => Promise<void>;
  myInvitations: MyInvitation[];
  respondToInvitation: (invitationId: string, accept: boolean) => Promise<void>;

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
  clearMonth: (month: string) => Promise<void>;
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
  setMyActiveSince: (date: string) => Promise<void>;
  // Owner-only in practice (enforced by RLS, not just the UI gate that calls
  // these): lets the space owner correct another member's name/color/join
  // date, distinct from updateMyMembership/setMyActiveSince which always
  // target the caller's own row.
  updateMember: (memberId: string, displayName: string, palette: number) => Promise<void>;
  setMemberActiveSince: (memberId: string, date: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  unlockAccount: () => Promise<void>;
  updateSpace: (spaceId: string, patch: { name?: string; currency?: string }) => Promise<void>;

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
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [myInvitations, setMyInvitations] = useState<MyInvitation[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A brief confetti burst whenever a settlement gets confirmed, regardless of
  // which surface (SettleView's inline button, EditEntryModal's Confirm button)
  // triggered it -- centralized here rather than duplicated per-caller.
  const [celebration, setCelebration] = useState<ConfettiPiece[]>([]);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "offline">("connecting");
  // Bumped on every loadSpaceData call; a response only gets applied if it's still the
  // most recent one requested, so a slow, stale fetch (e.g. from a space the user has
  // already switched away from) can never clobber newer state with older data.
  const spaceDataRequestRef = useRef(0);

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
      const requestId = ++spaceDataRequestRef.current;
      const [membersRes, categoriesRes, entriesRes] = await Promise.all([
        supabase.from("space_members").select("*").eq("space_id", spaceId).order("joined_at"),
        supabase.from("categories").select("*").eq("space_id", spaceId).order("sort_order"),
        supabase.from("entries").select("*").eq("space_id", spaceId).order("entry_date", { ascending: false }),
      ]);
      // A newer loadSpaceData call has been issued since this one started (e.g. the user
      // switched spaces again before this request resolved) -- applying this response now
      // would overwrite fresher state with stale data, so drop it on the floor instead.
      if (requestId !== spaceDataRequestRef.current) return;
      setMembers(membersRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
      setEntries(entriesRes.data ?? []);
    },
    [supabase]
  );

  // Pending invitations directed at me, enriched with the target space's name and
  // the inviter's display name -- both readable even for a space I'm not a member
  // of yet, thanks to the spaces_select_invited / profiles_select RLS policies.
  const loadMyInvitations = useCallback(async () => {
    const { data, error } = await supabase
      .from("space_invitations")
      .select("*, space:spaces(name), inviter:profiles!space_invitations_invited_by_fkey(display_name)")
      .eq("invited_user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error || !data) {
      setMyInvitations([]);
      return;
    }
    setMyInvitations(
      data.map((row) => {
        const { space, inviter, ...rest } = row;
        return {
          ...rest,
          space_name: space?.name ?? "",
          invited_by_name: inviter?.display_name ?? "",
        } as MyInvitation;
      })
    );
  }, [supabase, userId]);

  // initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // loadProfile and loadMyInvitations only need `userId`, not each other's
      // results, so they run alongside loadSpaces instead of waiting behind it --
      // only loadSpaceData genuinely depends on loadSpaces' result (which space to
      // load). Turns four sequential round-trips into two, cutting splash time.
      const [, list] = await Promise.all([loadProfile(), loadSpaces(), loadMyInvitations()]);
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

  // realtime subscription for invitations directed at me -- separate from the
  // space-scoped effect below since an invite to a brand-new space by definition
  // targets someone not yet a member of that space (so it can't be keyed on
  // activeSpaceId).
  useEffect(() => {
    const channel = supabase
      .channel(`invitations-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "space_invitations", filter: `invited_user_id=eq.${userId}` },
        () => loadMyInvitations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, loadMyInvitations]);

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

  // Permanently deletes a space and everything in it (members, categories,
  // entries, invites) -- RLS restricts this to the space's owner, and every
  // space_id foreign key cascades, so this one delete is enough server-side.
  const deleteSpace = useCallback(
    async (spaceId: string) => {
      const { error } = await supabase.from("spaces").delete().eq("id", spaceId);
      if (error) {
        showToast(t("toast_delete_space_error"));
        return;
      }
      const list = await loadSpaces();
      if (spaceId === activeSpaceId) {
        const next = list[0]?.id ?? null;
        if (next) {
          switchSpace(next);
        } else {
          setActiveSpaceId(null);
          setMembers([]);
          setCategories([]);
          setEntries([]);
          if (typeof window !== "undefined") localStorage.removeItem(ACTIVE_SPACE_STORAGE_KEY);
        }
      }
      showToast(t("toast_space_deleted"));
    },
    [supabase, activeSpaceId, loadSpaces, switchSpace, showToast, t]
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
        // NewSpaceModal already pre-checks the free-tier limit client-side before
        // ever calling this, so a real user shouldn't normally hit this path --
        // this is defense-in-depth (e.g. a race, or a future caller that skips
        // the pre-check) rather than the primary way the limit gets surfaced.
        showToast(error?.message === "free_space_limit" ? t("newspace_limit_toast") : t("toast_create_space_error"));
        return null;
      }
      await loadSpaces();
      switchSpace(data);
      showToast(t("toast_create_space_success"));
      // Returned so callers that need the new space's id right away (e.g. to invite
      // people to it before the modal closes) don't have to rely on activeSpaceId
      // having already re-rendered through context by the time this await resolves.
      return data;
    },
    [supabase, loadSpaces, switchSpace, showToast, t]
  );

  const updateSpace = useCallback(
    async (spaceId: string, patch: { name?: string; currency?: string }) => {
      const { error } = await supabase.from("spaces").update(patch).eq("id", spaceId);
      if (error) {
        showToast(t("toast_update_space_error"));
        return;
      }
      await loadSpaces();
      showToast(t("toast_space_updated"));
    },
    [supabase, loadSpaces, showToast, t]
  );

  const joinSpaceByCode = useCallback(
    async (code: string) => {
      const { data, error } = await supabase.rpc("redeem_invite", { p_code: code.trim() });
      if (error || !data) {
        return { ok: false, error: error?.message || t("error_invalid_invite_code") };
      }
      await loadSpaces();
      switchSpace(data);
      showToast(t("toast_join_space_success"));
      return { ok: true };
    },
    [supabase, loadSpaces, switchSpace, showToast, t]
  );

  const createInvite = useCallback(async () => {
    if (!activeSpaceId) return null;
    const { data, error } = await supabase.rpc("create_invite", { p_space_id: activeSpaceId });
    if (error || !data) {
      showToast(t("toast_create_invite_error"));
      return null;
    }
    return data;
  }, [supabase, activeSpaceId, showToast, t]);

  // People you've shared any other space with, minus whoever's already in the
  // target space -- a shortcut for who to send this invite to, not a way to add
  // them directly (joining still always requires them to accept/redeem the
  // invite). Defaults to the active space, but a caller can pass a different
  // (e.g. just-created) space id -- fetched fresh from the DB rather than the
  // `members` state, since that state may still reflect whatever space was
  // active a moment ago (switchSpace kicks off its own reload without
  // awaiting it) and would otherwise wrongly exclude valid candidates.
  const getPastCollaborators = useCallback(
    async (forSpaceId?: string) => {
      if (spaces.length === 0) return [];
      const spaceIds = spaces.map((s) => s.id);
      const targetSpaceId = forSpaceId ?? activeSpaceId;
      const [allRes, currentRes] = await Promise.all([
        supabase
          .from("space_members")
          .select("user_id, display_name, palette")
          .in("space_id", spaceIds)
          .neq("user_id", userId),
        targetSpaceId
          ? supabase.from("space_members").select("user_id").eq("space_id", targetSpaceId)
          : Promise.resolve({ data: [] as { user_id: string }[], error: null }),
      ]);
      if (allRes.error || !allRes.data) return [];
      const currentIds = new Set((currentRes.data ?? []).map((m) => m.user_id));
      const seen = new Map<string, { user_id: string; display_name: string; palette: number }>();
      allRes.data.forEach((m) => {
        if (currentIds.has(m.user_id) || seen.has(m.user_id)) return;
        seen.set(m.user_id, m);
      });
      return [...seen.values()];
    },
    [supabase, spaces, activeSpaceId, userId]
  );

  // Sends a real, in-app, directed invitation -- distinct from createInvite's
  // anonymous shareable code -- that the named person can accept/decline from
  // their own "pending invitations" list.
  const sendSpaceInvitation = useCallback(
    async (spaceId: string, invitedUserId: string) => {
      const { error } = await supabase
        .from("space_invitations")
        .insert({ space_id: spaceId, invited_user_id: invitedUserId, invited_by: userId });
      if (error) {
        // 23505 = unique_violation -- a pending invite to this person for this
        // space already exists (e.g. a fast double-tap raced two inserts).
        // That's not really a failure from the user's point of view, so don't
        // show a misleading "couldn't send" toast for it.
        if (error.code !== "23505") showToast(t("invite_send_failed_toast"));
        return;
      }
      showToast(t("invite_sent_toast"));
    },
    [supabase, userId, showToast, t]
  );

  const respondToInvitation = useCallback(
    async (invitationId: string, accept: boolean) => {
      const { error } = await supabase.rpc("respond_to_space_invitation", {
        p_invitation_id: invitationId,
        p_accept: accept,
      });
      if (error) {
        showToast(t("invitation_respond_failed_toast"));
        return;
      }
      await loadMyInvitations();
      if (accept) {
        await loadSpaces();
        showToast(t("invitation_accepted_toast"));
      } else {
        showToast(t("invitation_declined_toast"));
      }
    },
    [supabase, showToast, t, loadMyInvitations, loadSpaces]
  );

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
        showToast(t("toast_add_entry_error"));
        return;
      }
      setSelectedMonth(monthKey(input.date));
      showToast(input.kind === "credit" ? t("toast_credit_added") : t("toast_expense_added"));
      loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, userId, showToast, loadSpaceData, t]
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
        showToast(t("toast_update_entry_error"));
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast, t]
  );

  const deleteEntry = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) {
        showToast(t("toast_delete_entry_error"));
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast, t]
  );

  // Bulk-deletes every entry in a given month at once. RLS's entries_delete
  // policy still applies per row -- the space owner clears everyone's, a
  // regular member's request only actually removes the ones they were already
  // allowed to delete individually, silently leaving the rest untouched rather
  // than erroring.
  const clearMonth = useCallback(
    async (month: string) => {
      if (!activeSpaceId) return;
      const { error } = await supabase.from("entries").delete().eq("space_id", activeSpaceId).eq("month", month);
      if (error) {
        showToast(t("toast_clear_month_error"));
        return;
      }
      loadSpaceData(activeSpaceId);
      showToast(t("toast_month_cleared"));
    },
    [supabase, activeSpaceId, loadSpaceData, showToast, t]
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
        showToast(t("toast_settle_error"));
        return;
      }
      // A payment request for this pair is moot once payment is actually underway.
      await supabase
        .from("entries")
        .delete()
        .match({ space_id: activeSpaceId, kind: "request", from_id: fromId, to_id: toId });
      showToast(t("toast_settle_sent"));
      loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, userId, selectedMonth, showToast, loadSpaceData, t]
  );

  const confirmSettlement = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("entries").update({ status: "confirmed" }).eq("id", id);
      if (error) {
        showToast(t("toast_confirm_settlement_error"));
        return;
      }
      showToast(t("toast_settlement_confirmed"));
      if (activeSpaceId) loadSpaceData(activeSpaceId);
      setCelebration(makeConfettiPieces());
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      celebrationTimer.current = setTimeout(() => setCelebration([]), 2000);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast, t]
  );

  const declineSettlement = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) {
        showToast(t("toast_decline_settlement_error"));
        return;
      }
      showToast(t("toast_settlement_declined"));
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast, t]
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
        showToast(t("toast_request_payment_error"));
        return;
      }
      showToast(t("toast_payment_requested"));
      loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, userId, selectedMonth, showToast, loadSpaceData, t]
  );

  const cancelRequest = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) {
        showToast(t("toast_cancel_request_error"));
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast, t]
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
        showToast(t("toast_import_nothing_error"));
        return { imported: 0, skipped };
      }
      const { error } = await supabase.from("entries").insert(toInsert);
      if (error) {
        showToast(t("toast_import_failed_error"));
        return { imported: 0, skipped: rows.length };
      }
      showToast(
        skipped > 0
          ? t("toast_import_partial_success", { count: toInsert.length, skipped })
          : t("toast_import_success", { count: toInsert.length })
      );
      loadSpaceData(activeSpaceId);
      return { imported: toInsert.length, skipped };
    },
    [supabase, activeSpaceId, members, categories, userId, loadSpaceData, showToast, t]
  );

  const addCategory = useCallback(
    async (name: string, grp: "daily" | "housing") => {
      if (!activeSpaceId) return;
      const sortOrder = categories.length ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;
      const { error } = await supabase
        .from("categories")
        .insert({ space_id: activeSpaceId, name, grp, sort_order: sortOrder });
      if (error) {
        showToast(t("toast_add_category_error"));
        return;
      }
      loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, categories, loadSpaceData, showToast, t]
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
        showToast(t("toast_update_membership_error"));
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, members, userId, activeSpaceId, loadSpaceData, showToast, t]
  );

  const setMyActiveSince = useCallback(
    async (date: string) => {
      const mine = members.find((m) => m.user_id === userId);
      if (!mine) return;
      const { error } = await supabase.from("space_members").update({ active_since: date }).eq("id", mine.id);
      if (error) {
        showToast(t("toast_set_active_since_error"));
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, members, userId, activeSpaceId, loadSpaceData, showToast, t]
  );

  const updateMember = useCallback(
    async (memberId: string, displayName: string, palette: number) => {
      const { error } = await supabase
        .from("space_members")
        .update({ display_name: displayName, palette })
        .eq("id", memberId);
      if (error) {
        showToast(t("toast_update_membership_error"));
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast, t]
  );

  const setMemberActiveSince = useCallback(
    async (memberId: string, date: string) => {
      const { error } = await supabase.from("space_members").update({ active_since: date }).eq("id", memberId);
      if (error) {
        showToast(t("toast_set_active_since_error"));
        return;
      }
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast, t]
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

  // Lifts the free tier's one-owned-space limit (see createSpace). No real payment
  // processor exists yet -- this is the same tryout-preview spirit as the rest of
  // the unlock flow, just now backed by a real, persisted, enforced flag.
  const unlockAccount = useCallback(async () => {
    const { error } = await supabase.rpc("unlock_account");
    if (error) return;
    await loadProfile();
  }, [supabase, loadProfile]);

  const removeMember = useCallback(
    async (memberId: string) => {
      const target = members.find((m) => m.id === memberId);
      // Historical entries keep referencing a removed member's user_id as payer/from/to
      // forever, so removing someone with an open balance would leave an unresolvable
      // "phantom" debt with no member to attach it to. Block the removal instead --
      // the group has to settle up with this person first.
      if (target) {
        const categoriesById = new Map(categories.map((c) => [c.id, c]));
        const balances = calcThrough(
          entries,
          members.map((m) => m.user_id),
          categoriesById,
          FAR_FUTURE_MONTH
        );
        const outstanding = balances[target.user_id] ?? 0;
        if (Math.abs(outstanding) > 0.005) {
          showToast(t("toast_remove_member_has_balance"));
          return;
        }
      }
      const { error } = await supabase.from("space_members").delete().eq("id", memberId);
      if (error) {
        showToast(t("toast_remove_member_error"));
        return;
      }
      showToast(t("toast_member_removed"));
      if (activeSpaceId) loadSpaceData(activeSpaceId);
    },
    [supabase, activeSpaceId, loadSpaceData, showToast, members, categories, entries, t]
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
    celebration,
    realtimeStatus,
    switchSpace,
    deleteSpace,
    createSpace,
    joinSpaceByCode,
    createInvite,
    getPastCollaborators,
    sendSpaceInvitation,
    myInvitations,
    respondToInvitation,
    addEntry,
    updateEntry,
    deleteEntry,
    clearMonth,
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
    setMyActiveSince,
    updateMember,
    setMemberActiveSince,
    removeMember,
    unlockAccount,
    updateSpace,
    signOut,
  };

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>;
}
