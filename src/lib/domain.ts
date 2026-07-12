import type { Category, EntryRow, SplitValues } from "@/lib/types";

export function round(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function monthKey(dateStr: string): string {
  return String(dateStr).slice(0, 7);
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function currentMonth(): string {
  return monthKey(today());
}

export function monthName(key: string, short = false): string {
  const [y, m] = String(key).split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
  });
}

/** Signed contribution of an expense/credit entry: positive = money owed to the group, negative = credit. */
export function signed(e: EntryRow): number {
  return (e.kind === "credit" ? -1 : 1) * Number(e.amount || 0);
}

export function isHousing(e: EntryRow, categoriesById: Map<string, Category>): boolean {
  const c = e.category_id ? categoriesById.get(e.category_id) : undefined;
  return c?.grp === "housing";
}

/**
 * Distributes the signed amount of an entry across its participants according to its split
 * configuration. Returns a map of member user_id -> signed share.
 */
export function sharesForEntry(e: EntryRow, allMemberIds: string[]): SplitValues {
  const ids = (e.participant_ids && e.participant_ids.length ? e.participant_ids : allMemberIds).filter(
    (id) => allMemberIds.includes(id)
  );
  const amount = signed(e);
  const out: SplitValues = {};
  ids.forEach((id) => (out[id] = 0));
  if (!ids.length) return out;

  const type = e.split_type || "equal";
  const vals = (e.split_values as SplitValues) || {};

  if (type === "percent" || type === "shares") {
    const total = ids.reduce((s, id) => s + Number(vals[id] || 0), 0);
    if (total > 0) {
      ids.forEach((id) => (out[id] = amount * (Number(vals[id] || 0) / total)));
      return out;
    }
  }

  if (type === "amounts") {
    let used = 0;
    const empty: string[] = [];
    ids.forEach((id) => {
      const v = Number(vals[id]);
      if (Number.isFinite(v) && v > 0) {
        out[id] = Math.sign(amount) * v;
        used += v;
      } else {
        empty.push(id);
      }
    });
    const target = Math.abs(amount);
    if (used > target + 0.005 && used > 0) {
      // Entered amounts over-allocate the total: scale them down so shares still sum
      // to the entry amount instead of silently breaking the zero-sum balance invariant.
      const scale = target / used;
      ids.forEach((id) => {
        if (out[id]) out[id] = out[id] * scale;
      });
      return out;
    }
    const rem = Math.max(0, target - used);
    empty.forEach((id) => (out[id] = Math.sign(amount) * (rem / (empty.length || 1))));
    return out;
  }

  ids.forEach((id) => (out[id] = amount / ids.length));
  return out;
}

export type Balances = Record<string, number>;

/** Running balance for every member through (and including) `month`, across all entries. */
export function calcThrough(
  entries: EntryRow[],
  memberIds: string[],
  categoriesById: Map<string, Category>,
  month: string,
  { excludeHousing = false }: { excludeHousing?: boolean } = {}
): Balances {
  const bal: Balances = Object.fromEntries(memberIds.map((id) => [id, 0]));
  entries
    .filter((e) => e.month <= month)
    .forEach((e) => {
      if (e.kind === "request") {
        // A payment request is just a nudge -- it never claims money already
        // moved, so it can never affect balances, confirmed or not.
        return;
      }
      if (e.kind === "settlement") {
        // A settlement only moves balances once the other party has confirmed it --
        // an unconfirmed one shouldn't make a debt disappear before that happens.
        if (e.status === "pending") return;
        if (e.from_id) bal[e.from_id] = (bal[e.from_id] || 0) + Number(e.amount || 0);
        if (e.to_id) bal[e.to_id] = (bal[e.to_id] || 0) - Number(e.amount || 0);
        return;
      }
      if (excludeHousing && isHousing(e, categoriesById)) return;
      const amount = signed(e);
      if (e.payer_id) bal[e.payer_id] = (bal[e.payer_id] || 0) + amount;
      const shares = sharesForEntry(e, memberIds);
      Object.entries(shares).forEach(([id, v]) => (bal[id] = (bal[id] || 0) - v));
    });
  Object.keys(bal).forEach((k) => {
    if (Math.abs(bal[k]) < 0.005) bal[k] = 0;
    bal[k] = round(bal[k]);
  });
  return bal;
}

export type CategoryBreakdown = Record<
  string,
  { total: number; count: number; paid: Record<string, number> }
>;

export type MonthSummary = {
  total: number;
  paid: Record<string, number>;
  balances: Balances;
  byCat: CategoryBreakdown;
};

/** Aggregate stats for a single month (not cumulative). */
export function calcMonth(
  entries: EntryRow[],
  memberIds: string[],
  categoriesById: Map<string, Category>,
  month: string,
  { excludeHousing = false }: { excludeHousing?: boolean } = {}
): MonthSummary {
  const bal: Balances = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const paid: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));
  let total = 0;
  const byCat: CategoryBreakdown = {};

  entries
    .filter((e) => e.month === month && e.kind !== "settlement" && e.kind !== "request")
    .forEach((e) => {
      if (excludeHousing && isHousing(e, categoriesById)) return;
      const amount = signed(e);
      total += amount;
      if (e.payer_id) {
        paid[e.payer_id] = (paid[e.payer_id] || 0) + amount;
        bal[e.payer_id] = (bal[e.payer_id] || 0) + amount;
      }
      Object.entries(sharesForEntry(e, memberIds)).forEach(([id, v]) => (bal[id] = (bal[id] || 0) - v));
      const cName = (e.category_id ? categoriesById.get(e.category_id)?.name : undefined) || "Other";
      byCat[cName] = byCat[cName] || { total: 0, count: 0, paid: {} };
      byCat[cName].total += amount;
      byCat[cName].count++;
      if (e.payer_id) byCat[cName].paid[e.payer_id] = (byCat[cName].paid[e.payer_id] || 0) + amount;
    });

  return { total: round(total), paid, balances: bal, byCat };
}

export type Debt = { fromId: string; toId: string; amount: number };

/** Minimal set of payments that resolves a balance sheet (greedy debtor/creditor matching). */
export function simplify(bal: Balances): Debt[] {
  const debtors = Object.entries(bal)
    .filter(([, v]) => v < -0.005)
    .map(([id, v]) => ({ id, amount: -v }))
    .sort((a, b) => b.amount - a.amount);
  const creditors = Object.entries(bal)
    .filter(([, v]) => v > 0.005)
    .map(([id, v]) => ({ id, amount: v }))
    .sort((a, b) => b.amount - a.amount);

  const res: Debt[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const a = Math.min(debtors[i].amount, creditors[j].amount);
    if (a > 0.005) res.push({ fromId: debtors[i].id, toId: creditors[j].id, amount: round(a) });
    debtors[i].amount -= a;
    creditors[j].amount -= a;
    if (debtors[i].amount < 0.005) i++;
    if (creditors[j].amount < 0.005) j++;
  }
  return res;
}
