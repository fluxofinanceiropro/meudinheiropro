import { describe, it, expect } from "vitest";
import { categorySpending } from "./category-spending";
import type { Transaction } from "./queries";

const transaction = (patch: Partial<Transaction> = {}): Transaction => ({
  id: "tx", kind: "expense", description: "Almoço", amount: 20, occurred_on: "2026-10-20", status: "paid",
  payment_method: "debit_card", account_id: "account", to_account_id: null, card_id: null,
  category_id: "food", categories: { name: "Alimentação", icon: "utensils", color: "#123abc" }, ...patch,
});

describe("category spending", () => {
  it("uses the persisted category icon and color for its exact paid total", () => {
    expect(categorySpending([transaction(), transaction({ amount: 5.5 })], "2026-10")).toEqual([
      { id: "food", name: "Alimentação", value: 2550, icon: "utensils", color: "#123abc" },
    ]);
  });
  it("preserves month filtering and excludes income, transfers and pending expenses", () => {
    const rows = [transaction(), transaction({ kind: "income" }), transaction({ kind: "transfer" }), transaction({ status: "pending" }), transaction({ occurred_on: "2026-09-20" })];
    expect(categorySpending(rows, "2026-10").map((s) => s.value)).toEqual([2000]);
    expect(categorySpending(rows, "2026-11")).toEqual([]);
  });
  it("does not merge distinct categories with the same name", () => {
    const slices = categorySpending([transaction(), transaction({ category_id: "food-two", categories: { name: "Alimentação", color: "#2878c7" } })], "2026-10");
    expect(slices.map((s) => s.id)).toEqual(["food", "food-two"]);
    expect(slices.map((s) => s.color)).toEqual(["#123abc", "#2878c7"]);
  });
  it("retains legacy and uncategorized expenses without losing cents", () => {
    const slices = categorySpending([transaction({ categories: { name: "Antiga" }, amount: 0.1 }), transaction({ categories: null, category_id: null, amount: 0.2 })], "2026-10");
    expect(slices).toContainEqual({ id: "food", name: "Antiga", value: 10, color: "#087f60", icon: "circle" });
    expect(slices).toContainEqual({ id: "uncategorized", name: "Sem categoria", value: 20, color: "#4387bd", icon: "circle" });
  });
  it("preserves the four largest categories and sums the remainder as Other", () => {
    const rows = Array.from({ length: 6 }, (_, i) => transaction({ category_id: `cat-${i}`, amount: i + 1 }));
    const slices = categorySpending(rows, "2026-10");
    expect(slices.map((s) => s.value)).toEqual([600, 500, 400, 300, 300]);
    expect(slices.at(-1)?.id).toBe("other-categories");
    expect(slices.reduce((sum, s) => sum + s.value, 0)).toBe(2100);
  });
});