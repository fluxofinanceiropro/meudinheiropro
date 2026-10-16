import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { upcomingBills, todayISO } from "@/lib/finance";
import { formatBRL, toCents } from "@/lib/money";
import type { Transaction } from "@/lib/queries";

export function UpcomingBills({ transactions }: { transactions: Transaction[] }) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const today = todayISO();
  const bills = upcomingBills(transactions, today, 7);

  const pay = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").update({ status: "paid" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta marcada como paga");
      qc.invalidateQueries({ queryKey: ["transactions", workspace.id] });
      qc.invalidateQueries({ queryKey: ["balances", workspace.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl bg-card p-4 shadow-soft">
      <h2 className="mb-3 font-semibold">Contas a vencer (próximos 7 dias)</h2>
      {bills.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta a vencer. 🎉</p>}
      <ul className="divide-y">
        {bills.map((b) => {
          const overdue = b.occurred_on < today;
          return (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{b.description}</span>
                <span className={overdue ? "text-xs text-expense" : "text-xs text-muted-foreground"}>
                  {overdue ? "Atrasada · " : b.occurred_on === today ? "Vence hoje · " : "Vence "}
                  {b.occurred_on.split("-").reverse().join("/")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular text-sm font-semibold">{formatBRL(toCents(b.amount))}</span>
                <Button size="sm" variant="outline" disabled={pay.isPending} onClick={() => pay.mutate(b.id)}>
                  Paguei
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
