import { describe, it, expect } from "vitest";
import { matchesStatement, statementCsv } from "./csv";
import type { Transaction } from "./queries";
const tx: Transaction = { id: "1", kind: "expense", description: "Alimentação", amount: 20, occurred_on: "2026-10-19", status: "paid", payment_method: "debit", account_id: "a", to_account_id: null, category_id: null, card_id: null, categories: { name: "Alimentação" } };
describe("extrato CSV", () => {
  it("exporta R$20 em débito com conta e categoria", () => {
    const csv = statementCsv([tx], new Map([["a", "Nubank"]]), new Map());
    expect(csv).toContain('"20,00";"Pago";"Nubank"');
    expect(csv).toContain('"Alimentação";"Débito"');
  });
  it("aplica simultaneamente pesquisa, mês e tipo", () => {
    const filter = { search: "ALIMENT", month: "2026-10", kind: "expense" as const };
    expect(matchesStatement(tx, filter)).toBe(true);
    expect(matchesStatement({ ...tx, occurred_on: "2026-09-19" }, filter)).toBe(false);
    expect(matchesStatement({ ...tx, kind: "income" }, filter)).toBe(false);
    // A busca encontra tanto a descrição quanto o nome da categoria.
    expect(matchesStatement({ ...tx, description: "Aluguel" }, filter)).toBe(true);
    expect(matchesStatement({ ...tx, description: "Aluguel", categories: { name: "Moradia" } }, filter)).toBe(false);
  });
  it("preserva aspas e quebras, neutralizando fórmulas de planilha", () => {
    const csv = statementCsv([{ ...tx, description: '=HYPERLINK("x")\ntexto' }], new Map(), new Map());
    expect(csv).toContain('"\'=HYPERLINK(""x"")\ntexto"');
    expect(statementCsv([{ ...tx, description: " +SUM(1)" }], new Map(), new Map())).toContain("' +SUM(1)");
  });
  it("não trunca o CSV em 500 movimentações", () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ ...tx, id: String(i), description: `Gasto ${i}` }));
    expect(statementCsv(rows, new Map(), new Map()).split("\r\n")).toHaveLength(502);
  });
});