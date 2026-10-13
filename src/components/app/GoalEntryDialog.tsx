import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { parseBRL, centsToDecimal, formatBRL } from "@/lib/money";
import { todayISO } from "@/lib/finance";
import type { Goal } from "@/lib/goals";
import { balancesQuery } from "@/lib/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NO_ACCOUNT = "none";

interface Props {
  goal: Goal | null;
  savedCents: number;
  onOpenChange: (o: boolean) => void;
}

export function GoalEntryDialog({ goal, savedCents, onOpenChange }: Props) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const { data: accounts = [] } = useQuery(balancesQuery(workspace.id));
  const [accountId, setAccountId] = useState<string>(NO_ACCOUNT);
  const effectiveAccount = accountId;

  useEffect(() => {
    if (!goal) return;
    setMode("in");
    setAmount("");
    setDate(todayISO());
    setNote("");
    setAccountId(accounts[0]?.account_id ?? NO_ACCOUNT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!goal) return;
      const cents = parseBRL(amount);
      if (!cents || cents <= 0) throw new Error("Informe um valor");
      if (mode === "out" && cents > savedCents) throw new Error("Valor maior que o guardado");
      const signed = mode === "in" ? cents : -cents;
      const { error } = await supabase.from("goal_entries").insert({
        workspace_id: workspace.id,
        goal_id: goal.id,
        amount: centsToDecimal(signed) as unknown as number,
        occurred_on: date,
        note: note.trim() || null,
        account_id: effectiveAccount === NO_ACCOUNT ? null : effectiveAccount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(mode === "in" ? "Valor guardado" : "Retirada registrada");
      qc.invalidateQueries({ queryKey: ["goals", workspace.id] });
      qc.invalidateQueries({ queryKey: ["balances", workspace.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={!!goal} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goal?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Guardado: <span className="tabular">{formatBRL(savedCents)}</span></p>
        <form onSubmit={submit} className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "in" | "out")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="in">Guardar</TabsTrigger>
              <TabsTrigger value="out">Retirar</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry-amount">Valor (R$)</Label>
              <Input id="entry-amount" inputMode="decimal" placeholder="0,00" autoFocus value={amount}
                onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-date">Data</Label>
              <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-account">{mode === "in" ? "Sai da conta" : "Volta para a conta"}</Label>
            <Select value={effectiveAccount} onValueChange={setAccountId}>
              <SelectTrigger id="entry-account"><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => a.account_id && (
                  <SelectItem key={a.account_id} value={a.account_id}>{a.name}</SelectItem>
                ))}
                <SelectItem value={NO_ACCOUNT}>Nenhuma (não altera o saldo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-note">Observação (opcional)</Label>
            <Input id="entry-note" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando…" : "Confirmar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
