import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { transactionsQuery, type Transaction } from "@/lib/queries";
import { formatBRL, toCents } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth } from "@/lib/finance";
import { shiftInvoiceKey, invoiceLabel } from "@/lib/cards";
import { cn } from "@/lib/utils";
import { AddTransactionDialog } from "@/components/app/AddTransactionDialog";
import { ExportStatementButton } from "@/components/app/ExportStatementButton";
import { matchesStatement } from "@/lib/csv";
import { pageMeta } from "@/lib/page-meta";
import { CategoryIcon } from "@/components/app/CategoryIcon";

export const Route = createFileRoute("/_authenticated/_app/movimentacoes")({
  head: () => pageMeta("Movimentações", "Consulte, filtre e exporte suas entradas, saídas e transferências no Meu Controle."),
  component: Movimentacoes,
});

function Movimentacoes() {
  const { workspace } = useWorkspace();
  const { data: txs = [], isLoading } = useQuery(transactionsQuery(workspace.id));
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [month, setMonth] = useState<string | null>(currentMonth());
  const [kind, setKind] = useState<"all" | Transaction["kind"]>("all");
  const filter = { search: q, month, kind };
  const list = txs.filter((t) => matchesStatement(t, filter));
  const kinds = [["all", "Todas"], ["expense", "Saídas"], ["income", "Entradas"], ["transfer", "Transf."]] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Movimentações</h1>
      <ExportStatementButton key={`${workspace.id}-${q}-${month}-${kind}`} filter={filter} />
      <Input placeholder="Pesquisar" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex items-center justify-between rounded-2xl bg-card p-2 shadow-soft">
        <Button variant="ghost" size="icon" aria-label="Mês anterior" disabled={!month}
          onClick={() => month && setMonth(shiftInvoiceKey(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
        <button type="button" className="text-sm font-medium" onClick={() => setMonth(month ? null : currentMonth())}>
          {month ? invoiceLabel(month) : "Todos os meses"}
        </button>
        <Button variant="ghost" size="icon" aria-label="Próximo mês" disabled={!month}
          onClick={() => month && setMonth(shiftInvoiceKey(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por tipo">
        {kinds.map(([v, l]) => (
          <button key={v} type="button" onClick={() => setKind(v)} aria-pressed={kind === v}
            className={cn("rounded-full border px-3 py-1 text-sm", kind === v ? "bg-primary text-primary-foreground" : "bg-card")}>
            {l}
          </button>
        ))}
      </div>
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {!isLoading && list.length === 0 && <p className="text-muted-foreground">Nenhuma movimentação encontrada.</p>}
      <ul className="divide-y rounded-2xl bg-card shadow-soft">
        {list.map((t) => (
          <li key={t.id}>
             <button onClick={() => setEditing(t)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
               {t.kind !== "transfer" && <CategoryIcon category={t.categories} />}
               <span className="min-w-0 flex-1">
                 <span className="block break-words font-medium">{t.description}</span>
                <span className="text-xs text-muted-foreground">
                  {t.occurred_on.split("-").reverse().join("/")} · {t.categories?.name ?? (t.kind === "transfer" ? "Transferência" : "Sem categoria")}
                  {t.status === "pending" && " · pendente"}
                </span>
              </span>
              <span className={`tabular font-semibold ${t.kind === "income" ? "text-income" : t.kind === "expense" ? "text-expense" : "text-muted-foreground"}`}>
                {t.kind === "expense" ? "−" : t.kind === "income" ? "+" : ""}{formatBRL(toCents(t.amount))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <AddTransactionDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} editing={editing} />
    </div>
  );
}
