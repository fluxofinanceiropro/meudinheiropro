import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { parseBRL, centsToDecimal } from "@/lib/money";
import type { Card } from "@/lib/cards";

const DAYS = Array.from({ length: 28 }, (_, i) => String(i + 1));

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Card | null;
}

export function AddCardDialog({ open, onOpenChange, editing }: Props) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");
  const [closingDay, setClosingDay] = useState("1");
  const [dueDay, setDueDay] = useState("10");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setLimit(editing ? String(editing.limit_amount).replace(".", ",") : "");
    setClosingDay(String(editing?.closing_day ?? 1));
    setDueDay(String(editing?.due_day ?? 10));
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do cartão");
      const cents = parseBRL(limit || "0");
      if (cents < 0) throw new Error("Limite inválido");
      const row = {
        workspace_id: workspace.id,
        name: name.trim(),
        limit_amount: centsToDecimal(cents) as unknown as number,
        closing_day: Number(closingDay),
        due_day: Number(dueDay),
      };
      const { error } = editing
        ? await supabase.from("cards").update(row).eq("id", editing.id)
        : await supabase.from("cards").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Cartão atualizado" : "Cartão adicionado");
      qc.invalidateQueries({ queryKey: ["cards", workspace.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cartão" : "Novo cartão"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="card-name">Nome</Label>
            <Input id="card-name" maxLength={60} placeholder="Nubank, Inter…" value={name}
              onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-limit">Limite (R$)</Label>
            <Input id="card-limit" inputMode="decimal" placeholder="0,00" value={limit}
              onChange={(e) => setLimit(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dia de fechamento</Label>
              <Select value={closingDay} onValueChange={setClosingDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dia de vencimento</Label>
              <Select value={dueDay} onValueChange={setDueDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
