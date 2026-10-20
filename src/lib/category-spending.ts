import type { Transaction } from "./queries";
import { categoryColor, categoryIcon } from "./categories";
import { toCents } from "./money";

export interface SpendingSlice { id: string; name: string; value: number; icon: string; color: string }

export function categorySpending(transactions: Transaction[], month: string): SpendingSlice[] {
  const groups = new Map<string, SpendingSlice>();
  for (const tx of transactions) {
    if (tx.kind !== "expense" || tx.status !== "paid" || !tx.occurred_on.startsWith(month)) continue;
    const id = tx.category_id ?? "uncategorized";
    const previous = groups.get(id);
    groups.set(id, {
      id, name: tx.categories?.name ?? "Sem categoria",
      value: (previous?.value ?? 0) + toCents(tx.amount),
      icon: categoryIcon(tx.categories?.icon), color: categoryColor(tx.categories?.color),
    });
  }
  const sorted = [...groups.values()].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((sum, slice) => sum + slice.value, 0);
  if (rest > 0) top.push({ id: "other-categories", name: "Outras", value: rest, icon: "circle", color: categoryColor() });
  return top;
}