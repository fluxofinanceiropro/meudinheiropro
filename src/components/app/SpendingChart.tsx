import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { Transaction } from "@/lib/queries";
import { currentMonth } from "@/lib/finance";
import { shiftInvoiceKey, invoiceLabel } from "@/lib/cards";
import { formatBRL } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";
import { categorySpending } from "@/lib/category-spending";

export function SpendingChart({ transactions }: { transactions: Transaction[] }) {
  const [month, setMonth] = useState(currentMonth);
  const slices = useMemo(() => categorySpending(transactions, month), [transactions, month]);

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
    <div className="flex flex-col items-center gap-4 sm:flex-row">
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
                <Cell key={s.id} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <CategoryIcon category={s} />
            <span className="min-w-0 flex-1 break-words">{s.name}</span>
            <span className="shrink-0 tabular font-medium">{formatBRL(s.value)}</span>
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
