import { describe, it, expect } from "vitest";
import {
  round,
  monthKey,
  today,
  currentMonth,
  monthName,
  signed,
  isHousing,
  sharesForEntry,
  calcThrough,
  calcMonth,
  simplify,
} from "./domain";
import type { EntryRow, Category } from "@/lib/types";

let seq = 0;
function makeEntry(overrides: Partial<EntryRow> = {}): EntryRow {
  seq++;
  return {
    id: `e${seq}`,
    space_id: "s1",
    kind: "expense",
    amount: 100,
    category_id: null,
    payer_id: "u1",
    from_id: null,
    to_id: null,
    participant_ids: [],
    split_type: "equal",
    split_values: {},
    note: null,
    entry_date: "2026-07-01",
    month: "2026-07",
    recurring: false,
    status: "confirmed",
    created_by: "u1",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  } as EntryRow;
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "c1",
    space_id: "s1",
    name: "Groceries",
    grp: "daily",
    active: true,
    sort_order: 0,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  } as Category;
}

const sum = (bal: Record<string, number>) => Object.values(bal).reduce((a, b) => a + b, 0);

describe("round", () => {
  it("rounds to 2 decimal places", () => {
    expect(round(1.2345)).toBe(1.23);
    expect(round(1.005)).toBe(1.01);
  });

  it("handles classic float-precision drift", () => {
    expect(round(0.1 + 0.2)).toBe(0.3);
  });

  it("handles negative numbers", () => {
    expect(round(-1.2345)).toBe(-1.23);
  });

  it("passes through clean integers", () => {
    expect(round(2)).toBe(2);
  });
});

describe("monthKey", () => {
  it("extracts YYYY-MM from a date string", () => {
    expect(monthKey("2026-07-15")).toBe("2026-07");
  });

  it("extracts YYYY-MM from an ISO timestamp", () => {
    expect(monthKey("2026-07-15T10:00:00Z")).toBe("2026-07");
  });
});

describe("today / currentMonth", () => {
  it("returns a YYYY-MM-DD shaped string", () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a YYYY-MM shaped string consistent with today()", () => {
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
    expect(currentMonth()).toBe(today().slice(0, 7));
  });
});

describe("monthName", () => {
  it("includes the year in long form but not short form", () => {
    expect(monthName("2026-07", false)).toContain("2026");
    expect(monthName("2026-07", true)).not.toContain("2026");
  });

  it("falls back to the raw key for an unparseable month", () => {
    expect(monthName("not-a-month")).toBe("not-a-month");
  });
});

describe("signed", () => {
  it("keeps expense/settlement amounts positive", () => {
    expect(signed(makeEntry({ kind: "expense", amount: 50 }))).toBe(50);
    expect(signed(makeEntry({ kind: "settlement", amount: 50 }))).toBe(50);
  });

  it("flips credit amounts negative", () => {
    expect(signed(makeEntry({ kind: "credit", amount: 50 }))).toBe(-50);
  });
});

describe("isHousing", () => {
  const categoriesById = new Map([["c1", makeCategory({ id: "c1", grp: "housing" })]]);

  it("is true for a housing-group category", () => {
    expect(isHousing(makeEntry({ category_id: "c1" }), categoriesById)).toBe(true);
  });

  it("is false for an unknown category id", () => {
    expect(isHousing(makeEntry({ category_id: "unknown" }), categoriesById)).toBe(false);
  });

  it("is false when there's no category at all", () => {
    expect(isHousing(makeEntry({ category_id: null }), categoriesById)).toBe(false);
  });
});

describe("sharesForEntry", () => {
  const allMemberIds = ["u1", "u2", "u3"];

  it("splits equally across every member when no participants are named", () => {
    const e = makeEntry({ amount: 90, split_type: "equal", participant_ids: [] });
    expect(sharesForEntry(e, allMemberIds)).toEqual({ u1: 30, u2: 30, u3: 30 });
  });

  it("splits equally across an explicit participant subset", () => {
    const e = makeEntry({ amount: 60, split_type: "equal", participant_ids: ["u1", "u2"] });
    expect(sharesForEntry(e, allMemberIds)).toEqual({ u1: 30, u2: 30 });
  });

  it("filters out a participant who is no longer a member", () => {
    const e = makeEntry({ amount: 40, split_type: "equal", participant_ids: ["u1", "uGhost"] });
    expect(sharesForEntry(e, ["u1", "u2"])).toEqual({ u1: 40 });
  });

  it("splits proportionally by percent", () => {
    const e = makeEntry({
      amount: 100,
      split_type: "percent",
      split_values: { u1: 25, u2: 75 },
      participant_ids: ["u1", "u2"],
    });
    expect(sharesForEntry(e, allMemberIds)).toEqual({ u1: 25, u2: 75 });
  });

  it("splits proportionally by shares", () => {
    const e = makeEntry({
      amount: 90,
      split_type: "shares",
      split_values: { u1: 1, u2: 2 },
      participant_ids: ["u1", "u2"],
    });
    expect(sharesForEntry(e, allMemberIds)).toEqual({ u1: 30, u2: 60 });
  });

  it("falls back to an equal split when percent/shares values are all zero", () => {
    const e = makeEntry({
      amount: 80,
      split_type: "percent",
      split_values: {},
      participant_ids: ["u1", "u2"],
    });
    expect(sharesForEntry(e, allMemberIds)).toEqual({ u1: 40, u2: 40 });
  });

  it("leaves fully-specified custom amounts untouched when they already sum to the total", () => {
    const e = makeEntry({
      amount: 100,
      split_type: "amounts",
      split_values: { u1: 60, u2: 40 },
      participant_ids: ["u1", "u2"],
    });
    expect(sharesForEntry(e, allMemberIds)).toEqual({ u1: 60, u2: 40 });
  });

  it("scales down fully-specified custom amounts that over-allocate the total", () => {
    const e = makeEntry({
      amount: 100,
      split_type: "amounts",
      split_values: { u1: 70, u2: 70 },
      participant_ids: ["u1", "u2"],
    });
    const out = sharesForEntry(e, allMemberIds);
    expect(out).toEqual({ u1: 50, u2: 50 });
    expect(sum(out)).toBe(100);
  });

  it("scales up fully-specified custom amounts that under-allocate the total (regression)", () => {
    const e = makeEntry({
      amount: 100,
      split_type: "amounts",
      split_values: { u1: 30, u2: 30 },
      participant_ids: ["u1", "u2"],
    });
    const out = sharesForEntry(e, allMemberIds);
    expect(out).toEqual({ u1: 50, u2: 50 });
    expect(sum(out)).toBe(100);
  });

  it("distributes the remainder evenly across blank fields", () => {
    const e = makeEntry({
      amount: 100,
      split_type: "amounts",
      split_values: { u1: 60 },
      participant_ids: ["u1", "u2", "u3"],
    });
    const out = sharesForEntry(e, allMemberIds);
    expect(out).toEqual({ u1: 60, u2: 20, u3: 20 });
    expect(sum(out)).toBe(100);
  });

  it("leaves blank fields at zero when a single over-allocated amount already exceeds the total", () => {
    const e = makeEntry({
      amount: 100,
      split_type: "amounts",
      split_values: { u1: 150 },
      participant_ids: ["u1", "u2"],
    });
    const out = sharesForEntry(e, allMemberIds);
    expect(out).toEqual({ u1: 100, u2: 0 });
  });

  it("carries the credit sign through an equal split", () => {
    const e = makeEntry({
      kind: "credit",
      amount: 50,
      split_type: "equal",
      participant_ids: ["u1", "u2"],
    });
    expect(sharesForEntry(e, allMemberIds)).toEqual({ u1: -25, u2: -25 });
  });

  it("carries the credit sign through a custom-amounts split", () => {
    const e = makeEntry({
      kind: "credit",
      amount: 50,
      split_type: "amounts",
      split_values: { u1: 30, u2: 20 },
      participant_ids: ["u1", "u2"],
    });
    expect(sharesForEntry(e, allMemberIds)).toEqual({ u1: -30, u2: -20 });
  });

  it("returns an empty split when no named participant is still a member", () => {
    const e = makeEntry({ amount: 50, participant_ids: ["ghost1", "ghost2"] });
    expect(sharesForEntry(e, ["u1", "u2"])).toEqual({});
  });
});

describe("calcThrough", () => {
  const categoriesById = new Map([
    ["c1", makeCategory({ id: "c1", grp: "daily" })],
    ["cHousing", makeCategory({ id: "cHousing", grp: "housing" })],
  ]);
  const memberIds = ["u1", "u2"];

  it("nets a shared expense to zero across payer and participant", () => {
    const entries = [
      makeEntry({
        kind: "expense",
        amount: 100,
        payer_id: "u1",
        participant_ids: ["u1", "u2"],
        split_type: "equal",
        month: "2026-07",
      }),
    ];
    const bal = calcThrough(entries, memberIds, categoriesById, "2026-07");
    expect(bal).toEqual({ u1: 50, u2: -50 });
    expect(sum(bal)).toBe(0);
  });

  it("does not move balances for a pending settlement", () => {
    const entries = [
      makeEntry({ kind: "settlement", amount: 50, from_id: "u2", to_id: "u1", status: "pending", month: "2026-07" }),
    ];
    expect(calcThrough(entries, memberIds, categoriesById, "2026-07")).toEqual({ u1: 0, u2: 0 });
  });

  it("fully resolves a debt once the matching settlement is confirmed", () => {
    const entries = [
      makeEntry({
        kind: "expense",
        amount: 100,
        payer_id: "u1",
        participant_ids: ["u1", "u2"],
        split_type: "equal",
        month: "2026-07",
      }),
      makeEntry({ kind: "settlement", amount: 50, from_id: "u2", to_id: "u1", status: "confirmed", month: "2026-07" }),
    ];
    expect(calcThrough(entries, memberIds, categoriesById, "2026-07")).toEqual({ u1: 0, u2: 0 });
  });

  it("never lets a payment request affect balances", () => {
    const entries = [
      makeEntry({ kind: "request", amount: 50, from_id: "u1", to_id: "u2", status: "pending", month: "2026-07" }),
    ];
    expect(calcThrough(entries, memberIds, categoriesById, "2026-07")).toEqual({ u1: 0, u2: 0 });
  });

  it("excludes housing-category entries when asked", () => {
    const entries = [
      makeEntry({
        kind: "expense",
        amount: 100,
        payer_id: "u1",
        category_id: "cHousing",
        participant_ids: ["u1", "u2"],
        split_type: "equal",
        month: "2026-07",
      }),
      makeEntry({
        kind: "expense",
        amount: 40,
        payer_id: "u2",
        category_id: "c1",
        participant_ids: ["u1", "u2"],
        split_type: "equal",
        month: "2026-07",
      }),
    ];
    const bal = calcThrough(entries, memberIds, categoriesById, "2026-07", { excludeHousing: true });
    expect(bal).toEqual({ u1: -20, u2: 20 });
  });

  it("includes entries from earlier months but excludes entries from later months", () => {
    const earlier = calcThrough(
      [
        makeEntry({
          kind: "expense",
          amount: 100,
          payer_id: "u1",
          participant_ids: ["u1", "u2"],
          split_type: "equal",
          month: "2026-06",
        }),
      ],
      memberIds,
      categoriesById,
      "2026-07"
    );
    expect(earlier).toEqual({ u1: 50, u2: -50 });

    const later = calcThrough(
      [
        makeEntry({
          kind: "expense",
          amount: 100,
          payer_id: "u1",
          participant_ids: ["u1", "u2"],
          split_type: "equal",
          month: "2026-08",
        }),
      ],
      memberIds,
      categoriesById,
      "2026-07"
    );
    expect(later).toEqual({ u1: 0, u2: 0 });
  });

  it("zeroes out balances smaller than the rounding epsilon", () => {
    const entries = [
      makeEntry({
        kind: "expense",
        amount: 0.001,
        payer_id: "u1",
        participant_ids: ["u1", "u2"],
        split_type: "equal",
        month: "2026-07",
      }),
    ];
    expect(calcThrough(entries, memberIds, categoriesById, "2026-07")).toEqual({ u1: 0, u2: 0 });
  });
});

describe("calcMonth", () => {
  const categoriesById = new Map([["c1", makeCategory({ id: "c1", name: "Groceries" })]]);
  const memberIds = ["u1", "u2"];

  it("only counts expense/credit entries from the exact month", () => {
    const entries = [
      makeEntry({
        id: "e1",
        kind: "expense",
        amount: 60,
        payer_id: "u1",
        category_id: "c1",
        participant_ids: ["u1", "u2"],
        split_type: "equal",
        month: "2026-07",
      }),
      makeEntry({ id: "e2", kind: "settlement", amount: 1000, from_id: "u1", to_id: "u2", status: "confirmed", month: "2026-07" }),
      makeEntry({ id: "e3", kind: "request", amount: 1000, from_id: "u1", to_id: "u2", month: "2026-07" }),
      makeEntry({
        id: "e4",
        kind: "expense",
        amount: 999,
        payer_id: "u1",
        category_id: "c1",
        participant_ids: ["u1", "u2"],
        split_type: "equal",
        month: "2026-06",
      }),
    ];
    const summary = calcMonth(entries, memberIds, categoriesById, "2026-07");
    expect(summary.total).toBe(60);
    expect(summary.paid).toEqual({ u1: 60, u2: 0 });
    expect(summary.balances).toEqual({ u1: 30, u2: -30 });
    expect(summary.byCat).toEqual({ Groceries: { total: 60, count: 1, paid: { u1: 60 } } });
  });

  it("groups entries with no category under Other", () => {
    const entries = [
      makeEntry({
        kind: "expense",
        amount: 20,
        payer_id: "u1",
        category_id: null,
        participant_ids: ["u1", "u2"],
        split_type: "equal",
        month: "2026-07",
      }),
    ];
    const summary = calcMonth(entries, memberIds, categoriesById, "2026-07");
    expect(summary.byCat).toEqual({ Other: { total: 20, count: 1, paid: { u1: 20 } } });
  });
});

describe("simplify", () => {
  it("resolves a simple two-party debt", () => {
    expect(simplify({ u1: -50, u2: 50 })).toEqual([{ fromId: "u1", toId: "u2", amount: 50 }]);
  });

  it("collapses a debt chain to the minimum number of payments", () => {
    // A owes B 10, B owes C 10 -- nets to A owing C directly, B never touched.
    const debts = simplify({ A: -10, B: 0, C: 10 });
    expect(debts).toEqual([{ fromId: "A", toId: "C", amount: 10 }]);
  });

  it("returns no debts when every balance is already zero", () => {
    expect(simplify({ u1: 0, u2: 0, u3: 0 })).toEqual([]);
  });

  it("ignores balances smaller than the settlement epsilon", () => {
    expect(simplify({ u1: -0.001, u2: 0.001 })).toEqual([]);
  });

  it("greedily matches multiple debtors against one creditor", () => {
    const debts = simplify({ u1: -30, u2: -20, u3: 50 });
    expect(debts).toEqual([
      { fromId: "u1", toId: "u3", amount: 30 },
      { fromId: "u2", toId: "u3", amount: 20 },
    ]);
  });

  it("conserves total amounts owed/received across a multi-party balance sheet", () => {
    const bal = { A: -40, B: -10, C: 25, D: 25 };
    const debts = simplify(bal);

    const paidBy: Record<string, number> = {};
    const receivedBy: Record<string, number> = {};
    debts.forEach((d) => {
      paidBy[d.fromId] = (paidBy[d.fromId] || 0) + d.amount;
      receivedBy[d.toId] = (receivedBy[d.toId] || 0) + d.amount;
      expect(d.amount).toBeGreaterThan(0);
    });

    expect(paidBy.A).toBe(40);
    expect(paidBy.B).toBe(10);
    expect(receivedBy.C).toBe(25);
    expect(receivedBy.D).toBe(25);
    // Never more payments than the classic min-cash-flow upper bound.
    expect(debts.length).toBeLessThanOrEqual(3);
  });
});
