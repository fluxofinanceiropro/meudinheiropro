import { ArrowLeft } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PiggyBank, Plus, Pencil, Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { goalsQuery } from "@/lib/queries";
import { formatBRL, toCents } from "@/lib/money";
import { todayISO } from "@/lib/finance";
import { savedByGoal, progress, monthlyNeeded, type Goal } from "@/lib/goals";
import { GoalDialog } from "@/components/app/GoalDialog";
import { GoalEntryDialog } from "@/components/app/GoalEntryDialog";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/_app/metas")({
  head: () => pageMeta("Reserva e metas", "Acompanhe suas reservas, defina metas financeiras e registre aportes no Meu Controle."),
  component: Metas,
});

function Metas() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(goalsQuery(workspace.id));
  const saved = useMemo(() => savedByGoal(data.entries), [data.entries]);
  const total = [...saved.values()].reduce((a, b) => a + b, 0);
  const [dialog, setDialog] = useState<{ open: boolean; editing: Goal | null }>({ open: false, editing: null });
  const [entryGoal, setEntryGoal] = useState<Goal | null>(null);
  const today = todayISO();

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["goals", workspace.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild><Link to="/mais"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Mais</Link></Button>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reserva e metas</h1>
          <p className="text-sm text-muted-foreground">Total guardado: <span className="tabular font-medium text-foreground">{formatBRL(total)}</span></p>
        </div>
        <Button onClick={() => setDialog({ open: true, editing: null })}><Plus className="mr-1 h-4 w-4" />Nova</Button>
      </div>

      {data.goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
          <PiggyBank className="mx-auto h-10 w-10 text-primary" aria-hidden />
          <p className="mt-3 font-medium">Comece sua reserva de emergência</p>
          <p className="text-sm text-muted-foreground">Crie uma reserva ou uma meta e acompanhe quanto já guardou.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.goals.map((g) => {
            const s = saved.get(g.id) ?? 0;
            const t = toCents(g.target_amount);
            const p = progress(s, t);
            const monthly = monthlyNeeded(s, t, today, g.target_date);
            const Icon = g.kind === "reserve" ? PiggyBank : Target;
            return (
              <li key={g.id} className="space-y-3 rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" aria-hidden />
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.kind === "reserve" ? "Reserva" : "Meta"}
                        {g.target_date && ` · até ${new Date(g.target_date + "T12:00").toLocaleDateString("pt-BR")}`}</p>
                    </div>
                  </div>
                  <div className="flex">
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setDialog({ open: true, editing: g })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Remover"
                      onClick={() => confirm(`Remover "${g.name}"?`) && remove.mutate(g.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm tabular">
                    <span className="font-semibold">{formatBRL(s)}</span>
                    {t > 0 && <span className="text-muted-foreground">de {formatBRL(t)} · {Math.round(p * 100)}%</span>}
                  </div>
                  {t > 0 && <Progress value={p * 100} />}
                </div>
                {monthly !== null && (
                  <p className="text-xs text-muted-foreground">
                    {monthly === 0 ? "Objetivo alcançado 🎉" : <>Guarde <span className="tabular font-medium text-foreground">{formatBRL(monthly)}</span>/mês para chegar lá</>}
                  </p>
                )}
                <Button variant="outline" className="w-full" onClick={() => setEntryGoal(g)}>Guardar ou retirar</Button>
              </li>
            );
          })}
        </ul>
      )}

      <GoalDialog open={dialog.open} editing={dialog.editing} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
      <GoalEntryDialog goal={entryGoal} savedCents={entryGoal ? saved.get(entryGoal.id) ?? 0 : 0} onOpenChange={(o) => !o && setEntryGoal(null)} />
    </div>
  );
}
