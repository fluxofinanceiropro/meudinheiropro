import { toCents, type Cents } from "./money";

export type TxKind = "income" | "expense" | "transfer";
export type TxStatus = "pending" | "paid";

export interface TxLike {
  kind: TxKind;
  amount: number | string;
  status: TxStatus;
  occurred_on: string; // YYYY-MM-DD
}

export interface MonthSummary {
  income: Cents;
  expense: Cents;
  pendingExpense: Cents;
  pendingIncome: Cents;
  net: Cents;
}

/** Summarizes a month. Transfers never count as income or expense. */
export function summarizeMonth(txs: TxLike[], month: string /* YYYY-MM */): MonthSummary {
  const s: MonthSummary = { income: 0, expense: 0, pendingExpense: 0, pendingIncome: 0, net: 0 };
  for (const t of txs) {
    if (!t.occurred_on.startsWith(month) || t.kind === "transfer") continue;
    const c = toCents(t.amount);
    if (t.kind === "income") {
      if (t.status === "paid") s.income += c;
      else s.pendingIncome += c;
    } else if (t.status === "paid") s.expense += c;
    else s.pendingExpense += c;
  }
  s.net = s.income - s.expense;
  return s;
}

export function currentMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function todayISO(d = new Date()): string {
  return `${currentMonth(d)}-${String(d.getDate()).padStart(2, "0")}`;
}
