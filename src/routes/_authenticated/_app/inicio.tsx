import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/use-workspace";
import { balancesQuery, transactionsQuery } from "@/lib/queries";
import { summarizeMonth, currentMonth } from "@/lib/finance";
import { formatBRL, toCents } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/_app/inicio")({
  head: () => ({ meta: [{ title: "Início — Meu Controle" }] }),
  component: Inicio,
});

function Inicio() {
  const { workspace } = useWorkspace();
  const { data: accounts = [] } = useQuery(balancesQuery(workspace.id));
  const { data: txs = [] } = useQuery(transactionsQuery(workspace.id));
  const total = accounts.reduce((s, a) => s + toCents(a.balance), 0);
  const m = summarizeMonth(txs, currentMonth());

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-hero p-6 text-primary-foreground shadow-soft">
        <p className="text-sm opacity-80">Saldo disponível</p>
        <p className="font-display text-4xl font-semibold tabular">{formatBRL(total)}</p>
      </section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Entradas do mês" value={m.income} tone="text-income" />
        <Stat label="Saídas do mês" value={m.expense} tone="text-expense" />
        <Stat label="Contas a vencer" value={m.pendingExpense} tone="text-pending" />
        <Stat label="Resultado" value={m.net} tone="text-foreground" />
      </div>
      <section className="rounded-2xl bg-card p-4 shadow-soft">
        <h2 className="mb-3 font-semibold">Contas</h2>
        {accounts.map((a) => (
          <div key={a.account_id} className="flex justify-between py-2 text-sm">
            <span>{a.name}</span>
            <span className="tabular font-medium">{formatBRL(toCents(a.balance))}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-lg font-semibold tabular ${tone}`}>{formatBRL(value)}</p>
    </div>
  );
}
