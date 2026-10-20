import { describe, expect, it } from "vitest";
import { centsToDecimal, formatBRL, parseBRL, toCents } from "./money";
import { summarizeMonth, upcomingBills } from "./finance";
import { splitInstallments, shiftDateMonths } from "./cards";

describe("Etapa 4: integridade financeira", () => {
  it("não perde centavos ao dividir parcelas", () => {
    for (const cents of [1, 2, 3, 100, 999, 123456]) {
      for (const n of [1, 2, 3, 12, 24]) {
        const parts = splitInstallments(cents, n);
        expect(parts).toHaveLength(n);
        expect(parts.reduce((sum, value) => sum + value, 0)).toBe(cents);
      }
    }
  });

  it("lê valores brasileiros sem arredondamento de entrada", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("0,01")).toBe(1);
    expect(parseBRL("9,90")).toBe(990);
    expect(parseBRL("10,999")).toBeNull();
    expect(centsToDecimal(123456)).toBe("1234.56");
    expect(toCents("1234.56")).toBe(123456);
    expect(formatBRL(990)).toContain("9,90");
  });

  it("não contabiliza transferências como receitas ou despesas", () => {
    const transactions = [
      { kind: "income" as const, amount: "1000.00", status: "paid" as const, occurred_on: "2026-10-05" },
      { kind: "expense" as const, amount: "250.25", status: "paid" as const, occurred_on: "2026-10-06" },
      { kind: "transfer" as const, amount: "300.00", status: "paid" as const, occurred_on: "2026-10-07" },
      { kind: "expense" as const, amount: "100.00", status: "pending" as const, occurred_on: "2026-10-08" },
      { kind: "income" as const, amount: "800.00", status: "paid" as const, occurred_on: "2026-09-30" },
    ];
    const result = summarizeMonth(transactions, "2026-10");
    expect(result).toEqual({
      income: 100000,
      expense: 25025,
      pendingExpense: 10000,
      pendingIncome: 0,
      net: 74975,
    });
  });

  it("mostra contas vencidas e as que vencem dentro do prazo", () => {
    const base = { kind: "expense" as const, amount: 10, status: "pending" as const, card_id: null };
    const list = [
      { ...base, occurred_on: "2026-10-01" },
      { ...base, occurred_on: "2026-10-19" },
      { ...base, occurred_on: "2026-10-27" },
      { ...base, occurred_on: "2026-10-20", card_id: "card" },
    ];
    expect(upcomingBills(list, "2026-10-19", 7).map(x => x.occurred_on)).toEqual(["2026-10-01", "2026-10-19"]);
  });

  it("respeita meses curtos e virada do ano", () => {
    expect(shiftDateMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftDateMonths("2026-12-31", 2)).toBe("2027-02-28");
  });
});
