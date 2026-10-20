import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { balancesQuery, cardsQuery, categoriesQuery, type Transaction } from "@/lib/queries";
import { parseBRL, centsToDecimal, toCents } from "@/lib/money";
import { todayISO, type TxKind } from "@/lib/finance";
import { shiftDateMonths, splitInstallments } from "@/lib/cards";
import type { VoiceDraft } from "@/lib/voice/schema";

const METHODS = [
  { v: "pix", l: "Pix" },
  { v: "debit", l: "Débito" },
  { v: "credit_card", l: "Crédito" },
  { v: "cash", l: "Dinheiro" },
  { v: "boleto", l: "Boleto" },
  { v: "transfer", l: "Transferência" },
  { v: "other", l: "Outro" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Transaction | null;
  prefill?: VoiceDraft | null;
}

export function AddTransactionDialog({ open, onOpenChange, editing, prefill }: Props) {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery({ ...balancesQuery(workspace.id), enabled: open });
  const { data: categories = [] } = useQuery({ ...categoriesQuery(workspace.id), enabled: open });
  const { data: cards = [] } = useQuery({ ...cardsQuery(workspace.id), enabled: open });

  const [kind, setKind] = useState<TxKind>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState("pix");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cardId, setCardId] = useState("");
  const [installments, setInstallments] = useState("1");
  const [recurring, setRecurring] = useState(false);
  const [months, setMonths] = useState("12");

  useEffect(() => {
    if (!open) return;
    setKind(editing?.kind ?? prefill?.kind ?? "expense");
    setDescription(editing?.description ?? prefill?.description ?? "");
    setAmount(editing ? centsToDecimal(toCents(editing.amount)).replace(".", ",") : prefill?.amount_cents ? centsToDecimal(prefill.amount_cents).replace(".", ",") : "");
    setDate(editing?.occurred_on ?? prefill?.occurred_on ?? todayISO());
    setPaid(editing ? editing.status === "paid" : prefill?.paid ?? true);
    setMethod(editing?.payment_method ?? prefill?.payment_method ?? "pix");
    setAccountId(editing?.account_id ?? prefill?.account_id ?? "");
    setToAccountId(editing?.to_account_id ?? "");
    setCategoryId(editing?.category_id ?? prefill?.category_id ?? "");
    setCardId(editing?.card_id ?? prefill?.card_id ?? "");
    setInstallments(String(prefill?.installments ?? 1));
    setRecurring(false);
    setMonths("12");
  }, [open, editing, prefill]);

  const isCredit = kind === "expense" && method === "credit_card";
  const effectiveCard = cardId || (prefill ? "" : cards[0]?.id) || "";

  const effectiveAccount = accountId || (prefill && accounts.length !== 1 ? "" : accounts[0]?.account_id) || "";
  const kindCategories = categories.filter((c) => c.kind === kind);

  const mutation = useMutation({
    mutationFn: async () => {
      const cents = parseBRL(amount);
      if (!cents || cents <= 0) throw new Error("Informe um valor válido");
      if (!description.trim()) throw new Error("Informe uma descrição");
      if (!effectiveAccount) throw new Error("Selecione uma conta");
      if (kind === "transfer" && (!toAccountId || toAccountId === effectiveAccount))
        throw new Error("Escolha uma conta de destino diferente");
      if (isCredit && !effectiveCard) throw new Error("Selecione um cartão");
      const row = {
        workspace_id: workspace.id,
        kind,
        description: description.trim(),
        amount: centsToDecimal(cents) as unknown as number,
        occurred_on: date,
        status: (kind === "transfer" || (!isCredit && paid) ? "paid" : "pending") as "paid" | "pending",
        payment_method: kind === "transfer" ? "transfer" : method,
        account_id: effectiveAccount,
        to_account_id: kind === "transfer" ? toAccountId : null,
        category_id: kind === "transfer" ? null : categoryId || null,
        card_id: isCredit ? effectiveCard : null,
      };
      const n = isCredit ? Math.min(24, Math.max(1, Number.parseInt(installments) || 1)) : 1;
      const reps = Math.min(36, Math.max(2, Number.parseInt(months) || 12));
      if (editing) {
        const { data, error } = await supabase.from("transactions").update(row).eq("id", editing.id).eq("workspace_id", workspace.id).is("deleted_at", null).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("Não foi possível editar. Confira sua permissão neste espaço.");
      } else if (recurring && kind !== "transfer" && !isCredit) {
        const rows = Array.from({ length: reps }, (_, i) => ({
          ...row,
          occurred_on: shiftDateMonths(date, i),
          status: (i === 0 ? row.status : "pending") as "paid" | "pending",
        }));
        const { error } = await supabase.from("transactions").insert(rows);
        if (error) throw error;
      } else if (n > 1) {
        const parts = splitInstallments(cents, n);
        const rows = parts.map((part, i) => ({
          ...row,
          description: `${row.description} (${i + 1}/${n})`,
          amount: centsToDecimal(part) as unknown as number,
          occurred_on: shiftDateMonths(date, i),
        }));
        const { error } = await supabase.from("transactions").insert(rows);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Movimentação atualizada" : "Movimentação adicionada");
      qc.invalidateQueries({ queryKey: ["transactions", workspace.id] });
      qc.invalidateQueries({ queryKey: ["balances", workspace.id] });
      qc.invalidateQueries({ queryKey: ["statement-export", workspace.id] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { data, error } = await supabase.from("transactions")
        .update({ deleted_at: new Date().toISOString() }).eq("id", editing.id).eq("workspace_id", workspace.id).is("deleted_at", null).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Não foi possível excluir. Confira sua permissão neste espaço.");
    },
    onSuccess: () => {
      toast.success("Movimentação excluída");
      qc.invalidateQueries({ queryKey: ["transactions", workspace.id] });
      qc.invalidateQueries({ queryKey: ["balances", workspace.id] });
      qc.invalidateQueries({ queryKey: ["statement-export", workspace.id] });
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
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar ou excluir movimentação" : "Nova movimentação"}</DialogTitle>
        </DialogHeader>
        {prefill && <p className="text-sm text-muted-foreground">Revisar movimentação</p>}
        <form onSubmit={submit} className="space-y-4">
          <Tabs value={kind} onValueChange={(v) => { setKind(v as TxKind); setCategoryId(""); }}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="expense">Saída</TabsTrigger>
              <TabsTrigger value="income">Entrada</TabsTrigger>
              <TabsTrigger value="transfer">Transferir</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input id="amount" inputMode="decimal" placeholder="0,00" value={amount}
              onChange={(e) => setAmount(e.target.value)} className="h-14 font-display text-2xl tabular" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição</Label>
            <Input id="desc" maxLength={120} placeholder={kind === "income" ? "Salário" : "Supermercado"}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{kind === "transfer" ? "De" : "Conta"}</Label>
              <Select value={effectiveAccount} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => a.account_id ? <SelectItem key={a.account_id} value={a.account_id}>{a.name}</SelectItem> : null)}
                </SelectContent>
              </Select>
            </div>
            {kind === "transfer" ? (
              <div className="space-y-1.5">
                <Label>Para</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.account_id !== effectiveAccount).map((a) => (
                      a.account_id ? <SelectItem key={a.account_id} value={a.account_id}>{a.name}</SelectItem> : null
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
                  <SelectContent>
                    {kindCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {kind !== "transfer" && (
              <div className="space-y-1.5">
                <Label>Forma</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isCredit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cartão</Label>
                <Select value={effectiveCard} onValueChange={setCardId}>
                  <SelectTrigger><SelectValue placeholder="Cartão" /></SelectTrigger>
                  <SelectContent>
                    {cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="installments">Parcelas</Label>
                <Input id="installments" type="number" min={1} max={24} value={installments}
                  onChange={(e) => setInstallments(e.target.value)} disabled={!!editing} />
              </div>
            </div>
          )}

          {kind !== "transfer" && !isCredit && (
            <label className="flex items-center justify-between rounded-xl border p-3">
              <span className="text-sm">
                <span className="font-medium">{kind === "income" ? "Já recebi" : "Já paguei"}</span>
                <span className="block text-xs text-muted-foreground">
                  Desligado = fica como pendente e não altera o saldo
                </span>
              </span>
              <Switch checked={paid} onCheckedChange={setPaid} />
            </label>
          )}

          {kind !== "transfer" && !isCredit && !editing && (
            <div className="space-y-3 rounded-xl border p-3">
              <label className="flex items-center justify-between">
                <span className="text-sm">
                  <span className="font-medium">Fixa (repetir todo mês)</span>
                  <span className="block text-xs text-muted-foreground">
                    Aluguel, luz, assinaturas — os próximos meses ficam como pendentes
                  </span>
                </span>
                <Switch checked={recurring} onCheckedChange={setRecurring} />
              </label>
              {recurring && (
                <div className="space-y-1.5">
                  <Label htmlFor="months">Por quantos meses (2 a 36)</Label>
                  <Input id="months" type="number" min={2} max={36} value={months}
                    onChange={(e) => setMonths(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending || remove.isPending}>
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
          {editing && (
            <Button type="button" variant="ghost" className="w-full text-destructive"
              disabled={remove.isPending || mutation.isPending}
              onClick={() => { if (window.confirm("Excluir esta movimentação?")) remove.mutate(); }}>
              {remove.isPending ? "Excluindo…" : "Excluir movimentação"}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
