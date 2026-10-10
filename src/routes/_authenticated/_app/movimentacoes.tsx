import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { transactionsQuery, type Transaction } from "@/lib/queries";
import { formatBRL, toCents } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { AddTransactionDialog } from "@/components/app/AddTransactionDialog";

export const Route = createFileRoute("/_authenticated/_app/movimentacoes")({
  head: () => ({ meta: [{ title: "Movimentações — Meu Controle" }] }),
  component: Movimentacoes,
});

function Movimentacoes() {
  const { workspace } = useWorkspace();
  const { data: txs = [], isLoading } = useQuery(transactionsQuery(workspace.id));
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const list = txs.filter((t) => t.description.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Movimentações</h1>
      <Input placeholder="Pesquisar" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading && <p className="text-muted-foreground">Carregando…</p>}
      {!isLoading && list.length === 0 && <p className="text-muted-foreground">Nenhuma movimentação ainda.</p>}
      <ul className="divide-y rounded-2xl bg-card shadow-soft">
        {list.map((t) => (
          <li key={t.id}>
            <button onClick={() => setEditing(t)} className="flex w-full items-center justify-between p-4 text-left">
              <span>
                <span className="block font-medium">{t.description}</span>
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
