import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { CategoryIcon } from "@/components/app/CategoryIcon";
import { CategoryAppearancePicker } from "@/components/app/CategoryAppearancePicker";
import { categoryPayload, categoryIcon, categoryColor, isCategoryColor } from "@/lib/categories";
import { pageMeta } from "@/lib/page-meta";

export const Route = createFileRoute("/_authenticated/_app/contas")({
  head: () => pageMeta("Contas e categorias", "Gerencie suas contas e personalize categorias de entradas e saídas com cores e ícones."),
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
    if (!isCategoryColor(cat.color)) {
      toast.error("Informe uma cor válida no formato #RRGGBB");
      return;
    }
    const row = categoryPayload(name, cat);
    setSaving(true);
    try {
      const { error } = cat.id
        ? await supabase.from("categories").update(row).eq("id", cat.id).eq("workspace_id", ws)
        : await supabase.from("categories").insert({ ...row, kind: cat.kind, workspace_id: ws });
      if (error) throw error;
      toast.success(cat.id ? "Categoria atualizada" : "Categoria criada");
      setCat(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a categoria");
    } finally {
      setSaving(false);
    }
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
      <Button size="sm" onClick={() => setCat({ name: "", kind, icon: "circle", color: categoryColor() })}><Plus className="mr-1 h-4 w-4" />Nova categoria</Button>
      {categories.isLoading && <p role="status" className="text-sm text-muted-foreground">Carregando categorias…</p>}
      {categories.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar as categorias.</p>}
      <ul className="divide-y rounded-xl border bg-card">
        {(categories.data ?? []).filter((c) => c.kind === kind).map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-4 py-3">
            <CategoryIcon category={c} />
            <span className="min-w-0 flex-1 break-words">{c.name}</span>
            <Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`} onClick={() => setCat({ id: c.id, name: c.name, kind, icon: categoryIcon(c.icon), color: categoryColor(c.color) })}><Pencil className="h-4 w-4" /></Button>
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

      <Dialog open={!!cat} onOpenChange={(o) => !o && !saving && setCat(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{cat?.id ? "Editar categoria" : `Nova categoria de ${cat?.kind === "income" ? "entrada" : "saída"}`}</DialogTitle></DialogHeader>
          {cat && <div className="space-y-4">
            <div className="space-y-1"><Label htmlFor="cat-name">Nome</Label><Input id="cat-name" disabled={saving} value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /></div>
            <CategoryAppearancePicker name={cat.name} icon={cat.icon} color={cat.color} disabled={saving} onChange={(visual) => setCat({ ...cat, icon: categoryIcon(visual.icon), color: visual.color ?? categoryColor() })} />
          </div>}
          <DialogFooter><Button onClick={saveCategory} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
