import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChartNoAxesCombined } from "lucide-react";
import { useWorkspace } from "@/hooks/use-workspace";
import { transactionsQuery } from "@/lib/queries";
import { formatBRL, toCents } from "@/lib/money";
import { currentMonth, summarizeMonth } from "@/lib/finance";
import { SpendingChart } from "@/components/app/SpendingChart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/relatorios")({
 head: () => ({ meta: [{ title: "Relatórios — Meu Dinheiro Pro" }] }),
 component: Reports,
});
function Reports() {
 const { workspace } = useWorkspace();
 const { data: transactions = [], isPending, isError } = useQuery(transactionsQuery(workspace.id));
 const summary = summarizeMonth(transactions, currentMonth());
 return <div className="space-y-5">
  <Button asChild variant="ghost" size="sm"><Link to="/mais"><ArrowLeft className="mr-2 h-4 w-4"/>Voltar para Mais</Link></Button>
  <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><ChartNoAxesCombined className="h-6 w-6"/> Relatórios</h1>
  <p className="text-sm text-muted-foreground">Resumo financeiro do mês atual em {workspace.name}.</p></div>
  {isPending && <p>Carregando dados…</p>}
  {isError && <p role="alert">Não foi possível carregar as movimentações.</p>}
  {!isPending && !isError && <>
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <div className="rounded-2xl bg-card p-4 shadow-soft"><p className="text-sm text-muted-foreground">Entradas recebidas</p><p className="font-display text-xl font-semibold text-income">{formatBRL(summary.income)}</p></div>
    <div className="rounded-2xl bg-card p-4 shadow-soft"><p className="text-sm text-muted-foreground">Despesas pagas</p><p className="font-display text-xl font-semibold text-expense">{formatBRL(summary.expense)}</p></div>
    <div className="rounded-2xl bg-card p-4 shadow-soft"><p className="text-sm text-muted-foreground">Resultado</p><p className="font-display text-xl font-semibold">{formatBRL(summary.net)}</p></div>
   </div>
   <section className="rounded-2xl bg-card p-4 shadow-soft"><h2 className="mb-3 font-semibold">Gastos por categoria</h2><SpendingChart transactions={transactions}/></section>
   <p className="text-xs text-muted-foreground">Os cálculos consideram os lançamentos carregados no sistema (até 500 mais recentes). Para períodos mais antigos, consulte Movimentações e exporte o CSV.</p>
  </>}
 </div>;
}
