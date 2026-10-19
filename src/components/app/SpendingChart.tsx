import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { Transaction } from "@/lib/queries";
import { currentMonth } from "@/lib/finance";
import { shiftInvoiceKey, invoiceLabel } from "@/lib/cards";
import { formatBRL, toCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/app/CategoryIcon";

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
  icon: string | null;
}

export function SpendingChart({ transactions }: { transactions: Transaction[] }) {
  const [month, setMonth] = useState(currentMonth);
  const slices = useMemo<Slice[]>(() => {
    const byCat = new Map<string, { value: number; color: string | null; icon: string | null }>();
    for (const t of transactions) {
      if (t.kind !== "expense" || t.status !== "paid") continue;
      if (!t.occurred_on.startsWith(month)) continue;
      const name = t.categories?.name ?? "Sem categoria";
      const prev = byCat.get(name);
      byCat.set(name, { value: (prev?.value ?? 0) + toCents(t.amount), color: t.categories?.color ?? null, icon: t.categories?.icon ?? null });
    }
    const sorted = [...byCat.entries()].sort((a, b) => b[1].value - a[1].value);
    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4).reduce((s, [, v]) => s + v.value, 0);
    const rows = rest > 0 ? [...top, ["Outras", { value: rest, color: null, icon: null }] as [string, { value: number; color: string | null; icon: string | null }]] : top;
    return rows.map(([name, category], i) => ({
      name, value: category.value,
      color: category.color && /^#[0-9a-fA-F]{6}$/.test(category.color) ? category.color : COLORS[i % COLORS.length]!,
      icon: category.icon,
    }));
  }, [transactions, month]);

  const total = slices.reduce((s, x) => s + x.value, 0);

  const isCurrent = month === currentMonth();
  const nav = (
    <div className="mb-3 flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setMonth((m) => shiftInvoiceKey(m, -1))}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium capitalize">{invoiceLabel(month)}</span>
        {!isCurrent && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setMonth(currentMonth())}>
            Este mês
          </Button>
        )}
      </div>
      <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setMonth((m) => shiftInvoiceKey(m, 1))}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  if (slices.length === 0) {
    return (
      <div>
        {nav}
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma saída paga em {invoiceLabel(month)}.
        </p>
      </div>
    );
  }

  return (
    <div>
    {nav}
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
            <CategoryIcon icon={s.icon} color={s.color} />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="tabular font-medium">{formatBRL(s.value)}</span>
            <span className="w-10 text-right text-xs tabular text-muted-foreground">
              {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}
