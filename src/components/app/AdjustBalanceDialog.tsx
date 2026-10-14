import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { balancesQuery } from "@/lib/queries";
import { centsToDecimal, parseBRL, toCents } from "@/lib/money";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** Ajusta o saldo de cada conta ao valor informado.
 *  A diferença entre o saldo atual e o desejado é aplicada no saldo inicial,
 *  então o histórico de movimentações continua valendo. */
export function AdjustBalanceDialog({ open, onOpenChange }: Props) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery({ ...balancesQuery(workspace.id), enabled: open });
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const v: Record<string, string> = {};
    for (const a of accounts) {
      if (!a.account_id) continue;
      v[a.account_id] = centsToDecimal(toCents(a.balance ?? 0)).replace(".", ",");
    }
    setValues(v);
  }, [open, accounts]);

  const mutation = useMutation({
    mutationFn: async () => {
      for (const a of accounts) {
        const id = a.account_id;
        if (!id) continue;
        const desired = parseBRL(values[id] ?? "");
        if (desired === null) continue;
        const current = toCents(a.balance ?? 0);
        if (desired === current) continue;
        const initial = toCents(a.initial_balance ?? 0);
        const newInitial = initial + (desired - current);
        const { error } = await supabase
          .from("accounts")
          .update({ initial_balance: Number(centsToDecimal(newInitial)) })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saldos atualizados");
      qc.invalidateQueries({ queryKey: ["balances", workspace.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar saldo</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Digite o valor que cada conta tem hoje. A diferença entra no saldo inicial da conta, sem mexer nas movimentações.
        </p>
        <div className="space-y-3">
          {accounts.map((a) => {
            const id = a.account_id ?? "";
            return (
              <div key={id} className="space-y-1">
                <Label htmlFor={`saldo-${id}`}>{a.name}</Label>
                <Input
                  id={`saldo-${id}`}
                  inputMode="decimal"
                  placeholder="0,00"
                  value={values[id] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
                  className="tabular"
                />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
