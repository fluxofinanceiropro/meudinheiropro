import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CategoryIcon, CATEGORY_COLORS, CATEGORY_ICONS } from "@/components/app/CategoryIcon";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { balancesQuery, categoriesQuery } from "@/lib/queries";
import { centsToDecimal, formatBRL, parseBRL, toCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/_app/contas")({
  head: () => ({ meta: [{ title: "Contas e categorias — Meu Controle" }] }),
  component: ContasPage,
});

export const ACCOUNT_KIND_LABEL: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Carteira",
  other: "Outra",
};

interface AccountForm { id?: string | undefined; name: string; kind: string; initial: string }
interface CategoryForm { id?: string; name: string; kind: "expense" | "income"; icon: string; color: string }

function ContasPage() {
  const { workspace } = useWorkspace();
  const ws = workspace.id;
  const qc = useQueryClient();
  const accounts = useQuery(balancesQuery(ws));
  const categories = useQuery(categoriesQuery(ws));
  const [acc, setAcc] = useState<AccountForm | null>(null);
  const [cat, setCat] = useState<CategoryForm | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["balances", ws] });
    qc.invalidateQueries({ queryKey: ["categories", ws] });
    qc.invalidateQueries({ queryKey: ["transactions", ws] });
    qc.invalidateQueries({ queryKey: ["statement-export", ws] });
  };

  async function saveAccount() {
    if (!acc) return;
    const name = acc.name.trim();
    if (!name) {
      toast.error("Informe o nome da conta");
      return;
    }
    const row = { name, kind: acc.kind, initial_balance: Number(centsToDecimal(parseBRL(acc.initial) ?? 0)) };
    setSaving(true);
    const { error } = acc.id
      ? await supabase.from("accounts").update(row).eq("id", acc.id)
      : await supabase.from("accounts").insert({ ...row, workspace_id: ws });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(acc.id ? "Conta atualizada" : "Conta criada");
    setAcc(null);
    refresh();
  }

  async function removeAccount(id: string, name: string) {
    if ((accounts.data?.length ?? 0) <= 1) {
      toast.error("O espaço precisa ter pelo menos uma conta");
      return;
    }
    if (!confirm(`Arquivar a conta "${name}"? Ela some das listas e do saldo total.`)) return;
    const { error } = await supabase.from("accounts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta arquivada");
    refresh();
  }

  async function saveCategory() {
    if (!cat) return;
    const name = cat.name.trim();
    if (!name) {
      toast.error("Informe o nome da categoria");
      return;
    }
    setSaving(true);
    const { error } = cat.id
      ? await supabase.from("categories").update({ name, icon: cat.icon, color: cat.color }).eq("id", cat.id)
      : await supabase.from("categories").insert({ name, kind: cat.kind, icon: cat.icon, color: cat.color, workspace_id: ws });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(cat.id ? "Categoria atualizada" : "Categoria criada");
    setCat(null);
    refresh();
  }

  async function removeCategory(id: string, name: string) {
    if (!confirm(`Remover a categoria "${name}"? Lançamentos antigos continuam salvos.`)) return;
    const { error } = await supabase.from("categories").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Categoria removida");
    refresh();
  }

  const catList = (kind: "expense" | "income") => (
    <div className="space-y-2">
      <Button size="sm" onClick={() => setCat({ name: "", kind, icon: "circle", color: kind === "income" ? "#63a46c" : "#dc645b" })}><Plus className="mr-1 h-4 w-4" />Nova categoria</Button>
      <ul className="divide-y rounded-xl border bg-card">
        {(categories.data ?? []).filter((c) => c.kind === kind).map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-4 py-3">
            <span className="flex flex-1 items-center gap-2"><span className="rounded-lg p-2" style={{ backgroundColor: `${c.color || "#738094"}20` }}><CategoryIcon icon={c.icon} color={c.color} /></span>{c.name}</span>
            <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => setCat({ id: c.id, name: c.name, kind, icon: c.icon ?? "circle", color: c.color ?? "#738094" })}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label={`Remover ${c.name}`} onClick={() => removeCategory(c.id, c.name)}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Contas e categorias</h1>
      <Tabs defaultValue="contas">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="saidas">Cat. saídas</TabsTrigger>
          <TabsTrigger value="entradas">Cat. entradas</TabsTrigger>
        </TabsList>
        <TabsContent value="contas" className="space-y-2">
          <Button size="sm" onClick={() => setAcc({ name: "", kind: "checking", initial: "0,00" })}><Plus className="mr-1 h-4 w-4" />Nova conta</Button>
          <ul className="divide-y rounded-xl border bg-card">
            {(accounts.data ?? []).map((a) => (
              <li key={a.account_id} className="flex items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{ACCOUNT_KIND_LABEL[a.kind ?? ""] ?? a.kind}</p>
                </div>
                <span className="tabular text-sm font-medium">{formatBRL(toCents(a.balance ?? 0))}</span>
                <Button variant="ghost" size="icon" aria-label={`Editar ${a.name}`} onClick={() => setAcc({ id: a.account_id ?? undefined, name: a.name ?? "", kind: a.kind ?? "checking", initial: formatBRL(toCents(a.initial_balance ?? 0)).replace(/[^\d,.-]/g, "") })}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Arquivar ${a.name}`} onClick={() => removeAccount(a.account_id ?? "", a.name ?? "")}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="saidas">{catList("expense")}</TabsContent>
        <TabsContent value="entradas">{catList("income")}</TabsContent>
      </Tabs>

      <Dialog open={!!acc} onOpenChange={(o) => !o && setAcc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{acc?.id ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
          {acc && (
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="acc-name">Nome</Label><Input id="acc-name" placeholder="Ex.: Nubank" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Tipo</Label>
                <Select value={acc.kind} onValueChange={(v) => setAcc({ ...acc, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ACCOUNT_KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label htmlFor="acc-init">Saldo inicial (R$)</Label><Input id="acc-init" inputMode="decimal" value={acc.initial} onChange={(e) => setAcc({ ...acc, initial: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={saveAccount} disabled={saving}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cat} onOpenChange={(o) => !o && setCat(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{cat?.id ? "Editar categoria" : `Nova categoria de ${cat?.kind === "income" ? "entrada" : "saída"}`}</DialogTitle></DialogHeader>
          {cat && <div className="space-y-4">
            <div className="space-y-1"><Label htmlFor="cat-name">Nome</Label><Input id="cat-name" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Ícone</Label><div className="grid max-h-36 grid-cols-8 gap-2 overflow-y-auto">
              {Object.keys(CATEGORY_ICONS).map((key) => <button key={key} type="button" title={key} aria-label={`Ícone ${key}`} aria-pressed={cat.icon === key} onClick={() => setCat({ ...cat, icon: key })} className={`flex h-9 items-center justify-center rounded-lg border ${cat.icon === key ? "border-primary bg-accent" : ""}`}><CategoryIcon icon={key} color={cat.color} /></button>)}
            </div></div>
            <div className="space-y-2"><Label>Cor</Label><div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((color) => <button key={color} type="button" title={color} aria-label={`Cor ${color}`} aria-pressed={cat.color === color} onClick={() => setCat({ ...cat, color })} className={`h-8 w-8 rounded-full border-2 ${cat.color === color ? "ring-2 ring-primary ring-offset-2" : ""}`} style={{ backgroundColor: color }} />)}
              <input type="color" aria-label="Escolher outra cor" value={cat.color} onChange={(e) => setCat({ ...cat, color: e.target.value })} className="h-8 w-10 cursor-pointer" />
            </div></div>
          </div>}
          <DialogFooter><Button onClick={saveCategory} disabled={saving}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
