import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { Transaction } from "@/lib/queries";
import { currentMonth } from "@/lib/finance";
import { formatBRL, toCents } from "@/lib/money";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

interface Slice {
  name: string;
  value: number;
  color: string;
}

export function SpendingChart({ transactions }: { transactions: Transaction[] }) {
  const slices = useMemo<Slice[]>(() => {
    const month = currentMonth();
    const byCat = new Map<string, number>();
    for (const t of transactions) {
      if (t.kind !== "expense" || t.status !== "paid") continue;
      if (!t.occurred_on.startsWith(month)) continue;
      const name = t.categories?.name ?? "Sem categoria";
      byCat.set(name, (byCat.get(name) ?? 0) + toCents(t.amount));
    }
    const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4).reduce((s, [, v]) => s + v, 0);
    const rows = rest > 0 ? [...top, ["Outras", rest] as [string, number]] : top;
    return rows.map(([name, value], i) => ({
      name,
      value,
      color: COLORS[i % COLORS.length] ?? COLORS[0]!,
    }));
  }, [transactions]);

  const total = slices.reduce((s, x) => s + x.value, 0);

  if (slices.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma saída paga neste mês.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={72}
              strokeWidth={2}
              stroke="var(--color-card)"
            >
              {slices.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="tabular font-medium">{formatBRL(s.value)}</span>
            <span className="w-10 text-right text-xs tabular text-muted-foreground">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
