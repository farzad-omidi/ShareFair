import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;
export type Space = Tables<"spaces">;
export type SpaceMember = Tables<"space_members">;
export type Category = Tables<"categories">;
export type EntryRow = Tables<"entries">;
export type SpaceInvitationRow = Tables<"space_invitations">;

// A pending invitation directed at the current user, enriched with the target
// space's name and the inviter's display name for display purposes.
export type MyInvitation = SpaceInvitationRow & {
  space_name: string;
  invited_by_name: string;
};

export type EntryKind = "expense" | "credit" | "settlement";
export type SplitType = "equal" | "percent" | "shares" | "amounts";
export type CategoryGroup = "daily" | "housing";

export type SplitValues = Record<string, number>;

export type UiView = "Add" | "Month" | "Settle" | "Insights" | "More";

// A gentle in-app nudge for something that just started waiting on the
// current user -- a payment someone requested from them, a settlement
// someone else marked pending, or a space invitation. Distinct from `toast`
// (which only ever confirms the current user's own action): these are
// pushed by realtime events describing what someone *else* just did, and
// carry enough of their own display data (names, amount, space) to render
// without re-deriving it from live members/entries state, which may have
// already moved on by the time the banner is dismissed.
export type AppNotification =
  | {
      id: string;
      type: "payment_request";
      entryId: string;
      requesterName: string;
      requesterPalette: number;
      amount: number;
      currency: string;
    }
  | {
      id: string;
      type: "settlement_pending";
      entryId: string;
      creatorName: string;
      creatorPalette: number;
      amount: number;
      currency: string;
    }
  | { id: string; type: "invitation"; invitationId: string; inviterName: string; spaceName: string };
