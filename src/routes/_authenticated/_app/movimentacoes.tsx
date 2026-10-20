import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { transactionsQuery, type Transaction } from "@/lib/queries";
import { formatBRL, toCents } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pencil, Search, X } from "lucide-react";
import { currentMonth, todayISO } from "@/lib/finance";
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
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all" | "custom">("month");
  const [month, setMonth] = useState<string>(currentMonth());
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [kind, setKind] = useState<"all" | Transaction["kind"]>("all");
  const today = todayISO();
  const dayStart = new Date(today + "T12:00:00");
  const weekDay = (dayStart.getDay() + 6) % 7;
  dayStart.setDate(dayStart.getDate() - weekDay);
  const weekStart = [dayStart.getFullYear(), String(dayStart.getMonth() + 1).padStart(2, "0"), String(dayStart.getDate()).padStart(2, "0")].join("-");
  const filter = {
    search: q, kind,
    month: period === "month" ? month : null,
    startDate: period === "today" ? today : period === "week" ? weekStart : period === "custom" ? from : null,
    endDate: period === "today" || period === "week" ? today : period === "custom" ? to : null,
  };
  const invalidRange = period === "custom" && from > to;
  const list = invalidRange ? [] : txs.filter((t) => matchesStatement(t, filter));
  const kinds = [["all", "Todas"], ["expense", "Saídas"], ["income", "Entradas"], ["transfer", "Transf."]] as const;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Movimentações</h1>
      <div className="space-y-3 rounded-2xl bg-card p-3 shadow-soft">
        <div className="relative">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Pesquisar lançamentos por nome ou categoria" placeholder="Buscar por nome, descrição ou categoria..." className="pl-9 pr-10" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button type="button" aria-label="Limpar pesquisa" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setQ("")}><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por período">
          {([["today","Hoje"],["week","Esta semana"],["month","Mês"],["all","Tudo"],["custom","Personalizado"]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPeriod(value)} aria-pressed={period === value}
              className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", period === value ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent")}>{label}</button>
          ))}
        </div>
        {period === "month" && (
          <div className="flex items-center justify-between rounded-xl border bg-background px-2">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => setMonth((m) => shiftInvoiceKey(m, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium capitalize">{invoiceLabel(month)}</span>
            <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setMonth((m) => shiftInvoiceKey(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        )}
        {period === "custom" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">De <Input type="date" aria-label="Data inicial" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Até <Input type="date" aria-label="Data final" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            {invalidRange && <p role="alert" className="text-sm text-destructive sm:col-span-2">A data inicial deve ser anterior à data final.</p>}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{list.length} lançamento(s) encontrado(s)</p>
          {!invalidRange && <ExportStatementButton key={`${workspace.id}-${q}-${period}-${month}-${from}-${to}-${kind}`} filter={filter} />}
        </div>
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
          <li key={t.id} className="flex items-center gap-1 pr-3">
             <button type="button" aria-label={`Editar ${t.description}`} onClick={() => setEditing(t)} className="flex min-w-0 flex-1 items-center justify-between gap-3 p-4 text-left">
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
            <Button type="button" variant="outline" size="sm" aria-label={`Editar ou excluir ${t.description}`} onClick={() => setEditing(t)} className="shrink-0"><Pencil className="mr-1 h-4 w-4" />Editar</Button>
          </li>
        ))}
      </ul>
      <AddTransactionDialog key={`${workspace.id}-${editing?.id ?? "none"}`} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} editing={editing} />
    </div>
  );
}
