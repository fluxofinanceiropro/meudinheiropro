import { describe, expect, it } from "vitest";
import {
  invoiceKey,
  shiftInvoiceKey,
  invoiceDueDate,
  splitInstallments,
  shiftDateMonths,
  type Card,
} from "./cards";

const card: Card = { id: "c1", workspace_id: "w1", name: "Teste", limit_amount: 1000, closing_day: 5, due_day: 10 };

describe("invoiceKey", () => {
  it("compra até o dia de fechamento entra na fatura do mês", () => {
    expect(invoiceKey("2026-10-05", 5)).toBe("2026-10");
    expect(invoiceKey("2026-10-01", 5)).toBe("2026-10");
  });
  it("compra após o fechamento vai para a fatura seguinte", () => {
    expect(invoiceKey("2026-10-06", 5)).toBe("2026-11");
  });
  it("vira o ano em dezembro", () => {
    expect(invoiceKey("2026-12-20", 5)).toBe("2027-01");
  });
});

describe("shiftInvoiceKey", () => {
  it("avança e retrocede meses", () => {
    expect(shiftInvoiceKey("2026-10", 1)).toBe("2026-11");
    expect(shiftInvoiceKey("2026-01", -1)).toBe("2025-12");
  });
});

describe("invoiceDueDate", () => {
  it("vencimento após fechamento cai no mesmo mês da fatura", () => {
    expect(invoiceDueDate("2026-10", card)).toBe("10/10/2026");
  });
  it("vencimento antes do fechamento cai no mês seguinte", () => {
    const c = { ...card, closing_day: 20, due_day: 5 };
    expect(invoiceDueDate("2026-12", c)).toBe("05/01/2027");
  });
});

describe("splitInstallments", () => {
  it("divide igualmente quando exato", () => {
    expect(splitInstallments(300, 3)).toEqual([100, 100, 100]);
  });
  it("primeira parcela absorve o resto", () => {
    const parts = splitInstallments(100, 3);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });
});

describe("shiftDateMonths", () => {
  it("avança meses e limita o dia ao fim do mês", () => {
    expect(shiftDateMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftDateMonths("2026-10-15", 2)).toBe("2026-12-15");
  });
});
