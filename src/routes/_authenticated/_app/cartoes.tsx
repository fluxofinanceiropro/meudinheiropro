import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { cardsQuery, transactionsQuery, type Transaction } from "@/lib/queries";
import {
  currentInvoiceKey,
  invoiceDueDate,
  invoiceKey,
  invoiceLabel,
  shiftInvoiceKey,
  type Card,
} from "@/lib/cards";
import { formatBRL, toCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { AddCardDialog } from "@/components/app/AddCardDialog";

export const Route = createFileRoute("/_authenticated/_app/cartoes")({
  head: () => ({ meta: [{ title: "Cartões — Meu Controle" }] }),
  component: Cartoes,
});

function Cartoes() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const { data: cards = [] } = useQuery(cardsQuery(workspace.id));
  const { data: txs = [] } = useQuery(transactionsQuery(workspace.id));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cards").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cartão removido");
      qc.invalidateQueries({ queryKey: ["cards", workspace.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cartões</h1>
        <Button variant="lime" size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus /> Novo cartão
        </Button>
      </div>

      {cards.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-10 text-center shadow-soft">
          <CreditCard className="size-10 text-muted-foreground" />
          <p className="text-muted-foreground">
            Nenhum cartão ainda. Cadastre um para acompanhar faturas, parcelas e limite.
          </p>
        </div>
      )}

      {cards.map((card) => (
        <CardSection
          key={card.id}
          card={card}
          txs={txs.filter((t) => t.card_id === card.id)}
          onEdit={() => { setEditing(card); setDialogOpen(true); }}
          onDelete={() => deleteCard.mutate(card.id)}
        />
      ))}

      <AddCardDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />
    </div>
  );
}

function CardSection({ card, txs, onEdit, onDelete }: {
  card: Card;
  txs: Transaction[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => currentInvoiceKey(card.closing_day));

  const pending = txs.filter((t) => t.status === "pending");
  const committed = pending.reduce((s, t) => s + toCents(t.amount), 0);
  const limit = toCents(card.limit_amount);
  const usagePct = limit > 0 ? Math.min(100, Math.round((committed / limit) * 100)) : 0;

  const invoiceTxs = txs.filter((t) => invoiceKey(t.occurred_on, card.closing_day) === month);
  const invoiceTotal = invoiceTxs.reduce((s, t) => s + toCents(t.amount), 0);
  const invoicePaid = invoiceTxs.length > 0 && invoiceTxs.every((t) => t.status === "paid");

  const payInvoice = useMutation({
    mutationFn: async () => {
      const ids = invoiceTxs.filter((t) => t.status === "pending").map((t) => t.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("transactions").update({ status: "paid" }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fatura paga");
      qc.invalidateQueries({ queryKey: ["transactions", workspace.id] });
      qc.invalidateQueries({ queryKey: ["balances", workspace.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">{card.name}</h2>
          <p className="text-xs text-muted-foreground">
            Fecha dia {card.closing_day} · Vence dia {card.due_day}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Editar cartão" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Remover cartão" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {limit > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Limite usado</span>
            <span className="tabular">
              {formatBRL(committed)} de {formatBRL(limit)} ({usagePct}%)
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${usagePct >= 90 ? "bg-expense" : "bg-primary"}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
      )}

      <div className="rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <button aria-label="Fatura anterior" onClick={() => setMonth((m) => shiftInvoiceKey(m, -1))}
            className="rounded-full p-1.5 hover:bg-muted">
            <ChevronLeft className="size-5" />
          </button>
          <div className="text-center">
            <p className="text-sm font-medium">Fatura de {invoiceLabel(month)}</p>
            <p className="text-xs text-muted-foreground">Vence em {invoiceDueDate(month, card)}</p>
          </div>
          <button aria-label="Próxima fatura" onClick={() => setMonth((m) => shiftInvoiceKey(m, 1))}
            className="rounded-full p-1.5 hover:bg-muted">
            <ChevronRight className="size-5" />
          </button>
        </div>

        <p className="mt-3 text-center font-display text-3xl font-semibold tabular">
          {formatBRL(invoiceTotal)}
        </p>

        {invoiceTxs.length === 0 ? (
          <p className="mt-3 text-center text-sm text-muted-foreground">Sem compras nesta fatura.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {invoiceTxs.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="block">{t.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.occurred_on.split("-").reverse().join("/")}
                    {t.status === "pending" ? " · pendente" : " · paga"}
                  </span>
                </span>
                <span className="tabular font-medium">{formatBRL(toCents(t.amount))}</span>
              </li>
            ))}
          </ul>
        )}

        {invoiceTxs.length > 0 && !invoicePaid && (
          <Button className="mt-3 w-full" onClick={() => payInvoice.mutate()} disabled={payInvoice.isPending}>
            {payInvoice.isPending ? "Pagando…" : "Pagar fatura"}
          </Button>
        )}
        {invoicePaid && (
          <p className="mt-3 text-center text-sm font-medium text-income">Fatura paga ✓</p>
        )}
      </div>
    </section>
  );
}
