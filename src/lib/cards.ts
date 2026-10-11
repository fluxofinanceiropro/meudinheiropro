export interface Card {
  id: string;
  workspace_id: string;
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Invoice month key (YYYY-MM) for a purchase date, given the card's closing day. */
export function invoiceKey(dateISO: string, closingDay: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  if (d <= closingDay) return `${y}-${String(m).padStart(2, "0")}`;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function shiftInvoiceKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function currentInvoiceKey(closingDay: number, d = new Date()): string {
  return invoiceKey(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    closingDay,
  );
}

export function invoiceLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]}/${y}`;
}

/** Due date of an invoice: due_day of the invoice month (or next month when due_day <= closing_day). */
export function invoiceDueDate(key: string, card: Card): string {
  const [y, m] = key.split("-").map(Number);
  const next = card.due_day <= card.closing_day;
  const nm = next ? (m === 12 ? 1 : m + 1) : m;
  const ny = next && m === 12 ? y + 1 : y;
  return `${String(card.due_day).padStart(2, "0")}/${String(nm).padStart(2, "0")}/${ny}`;
}

/** Split a total in cents into n installments; the first absorbs the remainder. */
export function splitInstallments(totalCents: number, n: number): number[] {
  const base = Math.floor(totalCents / n);
  const parts = Array.from({ length: n }, () => base);
  parts[0] += totalCents - base * n;
  return parts;
}

/** Shift a YYYY-MM-DD date by whole months, clamping the day. */
export function shiftDateMonths(dateISO: string, delta: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const maxDay = new Date(ny, nm, 0).getDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, maxDay)).padStart(2, "0")}`;
}
