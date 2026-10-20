import type { Transaction } from "./queries";
import { categoryColor, categoryIcon, DEFAULT_CATEGORY_COLOR } from "./categories";
import { toCents } from "./money";

const FALLBACK_COLORS = ["#087f60", "#c3dc78", "#dc645b", "#d68b3f", "#4387bd", "#9b54bc", "#33958e"];

function fallbackColor(id: string): string {
  // Stable across month changes, independent of chart order.
  let hash = 0;
  for (const char of id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return FALLBACK_COLORS[(hash >>> 0) % FALLBACK_COLORS.length]!;
}

function fallbackIcon(name: string): string {
  const lower = name.toLocaleLowerCase("pt-BR");
  if (/transport|combust|uber|ônibus|onibus/.test(lower)) return "car";
  if (/morad|aluguel|casa|residên|residen/.test(lower)) return "home";
  if (/compr|mercad|shopping/.test(lower)) return "shopping-cart";
  if (/alimenta|comida|restaurante|refei/.test(lower)) return "utensils";
  if (/saúde|saude|médic|medic/.test(lower)) return "heart";
  if (/educa|escola|curso/.test(lower)) return "graduation-cap";
  if (/lazer|entreten/.test(lower)) return "music";
  return "circle";
}

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
      icon: !tx.categories?.icon || categoryIcon(tx.categories.icon) === "circle"
        ? fallbackIcon(tx.categories?.name ?? "")
        : categoryIcon(tx.categories.icon),
      color: !tx.categories?.color || categoryColor(tx.categories.color) === DEFAULT_CATEGORY_COLOR
        ? fallbackColor(id)
        : categoryColor(tx.categories.color),
    });
  }
  const sorted = [...groups.values()].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((sum, slice) => sum + slice.value, 0);
  if (rest > 0) top.push({ id: "other-categories", name: "Outras", value: rest, icon: "circle", color: "#738094" });
  return top;
}