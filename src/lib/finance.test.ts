import { describe, it, expect } from "vitest";
import { parseBRL, centsToDecimal } from "./money";
import { summarizeMonth } from "./finance";

describe("parseBRL", () => {
  it("parses Brazilian format", () => expect(parseBRL("1.234,56")).toBe(123456));
  it("parses integer", () => expect(parseBRL("180")).toBe(18000));
  it("rejects garbage", () => expect(parseBRL("abc")).toBeNull());
  it("avoids float drift", () => expect(centsToDecimal(parseBRL("0,10")! + parseBRL("0,20")!)).toBe("0.30"));
});

describe("summarizeMonth", () => {
  const txs = [
    { kind: "income" as const, amount: 3000, status: "paid" as const, occurred_on: "2026-10-05" },
    { kind: "expense" as const, amount: "180.00", status: "paid" as const, occurred_on: "2026-10-06" },
    { kind: "expense" as const, amount: 500, status: "pending" as const, occurred_on: "2026-10-20" },
    { kind: "transfer" as const, amount: 1000, status: "paid" as const, occurred_on: "2026-10-07" },
    { kind: "income" as const, amount: 99, status: "paid" as const, occurred_on: "2026-09-30" },
  ];
  const s = summarizeMonth(txs, "2026-10");
  it("transfers are not income nor expense", () => {
    expect(s.income).toBe(300000);
    expect(s.expense).toBe(18000);
  });
  it("pending expenses are separate from paid", () => expect(s.pendingExpense).toBe(50000));
  it("net is paid income minus paid expense", () => expect(s.net).toBe(282000));
});

import { upcomingBills } from "./finance";
describe("upcomingBills", () => {
  const base = { kind: "expense" as const, amount: 10, status: "pending" as const, card_id: null };
  it("inclui atrasadas e até 7 dias, exclui cartão/pagas/além do prazo", () => {
    const txs = [
      { ...base, occurred_on: "2026-10-23" },
      { ...base, occurred_on: "2026-10-24" },
      { ...base, occurred_on: "2026-10-01" },
      { ...base, occurred_on: "2026-10-18", card_id: "c" },
      { ...base, occurred_on: "2026-10-18", status: "paid" as const },
    ];
    expect(upcomingBills(txs, "2026-10-16").map((t) => t.occurred_on)).toEqual(["2026-10-01", "2026-10-23"]);
  });
});
