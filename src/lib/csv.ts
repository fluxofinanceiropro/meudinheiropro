import type { Transaction } from "./queries";
import { centsToDecimal, toCents } from "./money";

export interface StatementFilter { search: string; month: string | null; kind: "all" | Transaction["kind"]; }
export function matchesStatement(t: Transaction, filter: StatementFilter): boolean {
  return t.description.toLocaleLowerCase("pt-BR").includes(filter.search.toLocaleLowerCase("pt-BR")) &&
    (!filter.month || t.occurred_on.startsWith(filter.month)) && (filter.kind === "all" || t.kind === filter.kind);
}
function cell(value: string): string {
  const safe = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
const kinds = { expense: "Saída", income: "Entrada", transfer: "Transferência" };
const methods: Record<string, string> = { pix: "Pix", debit: "Débito", credit_card: "Crédito", cash: "Dinheiro", boleto: "Boleto", transfer: "Transferência", other: "Outro" };
export function statementCsv(rows: Transaction[], accounts: Map<string, string>, cards: Map<string, string>): string {
  const header = ["Data", "Descrição", "Tipo", "Valor (R$)", "Status", "Conta", "Conta destino", "Categoria", "Forma", "Cartão"];
  const lines = rows.map((t) => [t.occurred_on, t.description, kinds[t.kind], centsToDecimal(toCents(t.amount)).replace(".", ","),
    t.status === "paid" ? "Pago" : "Pendente", accounts.get(t.account_id) ?? "Conta arquivada", t.to_account_id ? accounts.get(t.to_account_id) ?? "Conta arquivada" : "",
    t.categories?.name ?? "Sem categoria", t.payment_method ? methods[t.payment_method] ?? t.payment_method : "", t.card_id ? cards.get(t.card_id) ?? "Cartão arquivado" : ""]);
  return "\uFEFF" + [header, ...lines].map((line) => line.map(cell).join(";")).join("\r\n");
}