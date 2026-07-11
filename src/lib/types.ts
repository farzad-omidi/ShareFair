import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;
export type Space = Tables<"spaces">;
export type SpaceMember = Tables<"space_members">;
export type Category = Tables<"categories">;
export type EntryRow = Tables<"entries">;

export type EntryKind = "expense" | "credit" | "settlement";
export type SplitType = "equal" | "percent" | "shares" | "amounts";
export type CategoryGroup = "daily" | "housing";

export type SplitValues = Record<string, number>;

export type UiView = "Add" | "Month" | "Settle" | "Insights" | "More";
