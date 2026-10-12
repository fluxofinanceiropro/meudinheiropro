import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { parseBRL, centsToDecimal } from "@/lib/money";
import type { Goal } from "@/lib/goals";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Goal | null;
}

export function GoalDialog({ open, onOpenChange, editing }: Props) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Goal["kind"]>("goal");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setKind(editing?.kind ?? "goal");
    setTarget(editing ? String(editing.target_amount).replace(".", ",") : "");
    setDate(editing?.target_date ?? "");
  }, [open, editing]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Dê um nome para a meta");
      const cents = parseBRL(target || "0");
      if (cents === null || cents < 0) throw new Error("Valor alvo inválido");
      const row = {
        workspace_id: workspace.id,
        name: name.trim(),
        kind,
        target_amount: centsToDecimal(cents) as unknown as number,
        target_date: date || null,
      };
      const { error } = editing
        ? await supabase.from("goals").update(row).eq("id", editing.id)
        : await supabase.from("goals").insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? "Meta atualizada" : "Meta criada");
      qc.invalidateQueries({ queryKey: ["goals", workspace.id] });
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
          <DialogTitle>{editing ? "Editar" : "Nova reserva ou meta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Tabs value={kind} onValueChange={(v) => setKind(v as Goal["kind"])}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reserve">Reserva</TabsTrigger>
              <TabsTrigger value="goal">Meta</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Nome</Label>
            <Input id="goal-name" maxLength={60} autoFocus value={name}
              placeholder={kind === "reserve" ? "Reserva de emergência" : "Viagem, carro…"}
              onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Valor alvo (R$)</Label>
              <Input id="goal-target" inputMode="decimal" placeholder="0,00" value={target}
                onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-date">Até quando (opcional)</Label>
              <Input id="goal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
