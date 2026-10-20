import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Users, Clock3, Wallet, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Meu Dinheiro Pro" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminPage,
});

type Customer = {
  owner_id: string; name: string; email: string; subscription_status: string;
  trial_ends_at: string; paid_until: string | null;
  workspace_count: number; pending_payments: number; legacy_access: boolean;
};
type Payment = { id: string; owner_id: string; name: string; email: string; amount: number; plan_code: string; created_at: string; status: string };
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "—";

function AdminPage() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const permission = useQuery({
    queryKey: ["saas-admin-permission"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_saas_admin");
      if (error) throw error;
      return data === true;
    }, retry: 1,
  });
  const customers = useQuery({
    queryKey: ["saas-admin-customers"],
    enabled: permission.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_saas_overview");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });
  const payments = useQuery({
    queryKey: ["saas-admin-payments"],
    enabled: permission.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_pending_payments");
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });
  async function confirm(payment: Payment) {
    if (!window.confirm(`Você conferiu o recebimento real de R$ ${Number(payment.amount).toFixed(2).replace(".", ",")} no banco? Liberar ${payment.plan_code === "annual" ? "1 ano" : "30 dias"} para ${payment.email}?`)) return;
    setBusy(payment.id);
    try {
      const { error } = await supabase.rpc("admin_confirm_pix", { _request_id: payment.id });
      if (error) throw error;
      toast.success("Pagamento confirmado e período contratado liberado.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["saas-admin-payments"] }),
        qc.invalidateQueries({ queryKey: ["saas-admin-customers"] }),
      ]);
    } catch (error) { toast.error((error as Error).message); }
    finally { setBusy(null); }
  }
  if (permission.isPending) return <div className="mx-auto max-w-5xl p-8">Verificando acesso administrativo…</div>;
  if (permission.isError) return <div className="mx-auto max-w-lg space-y-3 p-8"><h1 className="font-semibold">Não foi possível verificar o acesso</h1><p className="text-sm text-muted-foreground">O painel ainda pode precisar da configuração de segurança no banco.</p><Button onClick={() => permission.refetch()}>Tentar novamente</Button></div>;
  if (!permission.data) return <div className="mx-auto max-w-lg space-y-3 p-8"><ShieldCheck className="h-10 w-10"/><h1 className="text-xl font-semibold">Acesso restrito</h1><p>Esta área é exclusiva do administrador do Meu Dinheiro Pro.</p><Button asChild variant="outline"><Link to="/inicio">Voltar ao sistema</Link></Button></div>;
  const list = customers.data ?? [];
  const trials = list.filter(x => x.subscription_status === "trial").length;
  const active = list.filter(x => x.subscription_status === "active" || x.subscription_status === "legacy").length;
  const expired = list.filter(x => x.subscription_status === "expired").length;
  return <main className="mx-auto max-w-6xl space-y-6 p-4 py-8 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-sm text-primary"><ShieldCheck className="h-4 w-4"/> Administração exclusiva</p><h1 className="text-3xl font-bold">Meu Dinheiro Pro • Admin</h1><p className="text-sm text-muted-foreground">Clientes, testes e pagamentos Pix</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => {void customers.refetch();void payments.refetch();}}><RefreshCw className="mr-2 h-4 w-4"/>Atualizar</Button><Button asChild variant="outline"><Link to="/inicio">Sistema</Link></Button></div></div>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {([{label:"Clientes",value:list.length,icon:Users},{label:"Em teste",value:trials,icon:Clock3},{label:"Com acesso",value:active,icon:CheckCircle2},{label:"Vencidos",value:expired,icon:Wallet}] as const).map(({label,value,icon:Icon})=><div className="rounded-2xl border bg-card p-4" key={label}><Icon className="mb-2 h-5 w-5 text-primary"/><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{customers.isPending ? "…" : value}</p></div>)}
    </section>
    <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="text-lg font-semibold">Pagamentos aguardando conferência</h2><p className="text-sm text-muted-foreground">Confirme apenas após verificar no extrato bancário que o Pix foi recebido. Uma solicitação não comprova pagamento.</p>
      {payments.isError && <p role="alert" className="text-destructive">{payments.error.message}</p>}
      {payments.isPending && <p>Carregando…</p>}
      {payments.data?.length===0 && <p className="text-sm text-muted-foreground">Nenhum pagamento pendente.</p>}
      <ul className="divide-y">{payments.data?.map(payment=><li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{payment.name} · {payment.plan_code === "annual" ? "Anual" : "Mensal"} · R$ {Number(payment.amount).toFixed(2).replace(".",",")}</p><p className="text-xs text-muted-foreground">{payment.email} · {formatDate(payment.created_at)}</p></div><Button disabled={busy!==null} onClick={()=>void confirm(payment)}>{busy===payment.id?"Confirmando…":"Confirmar Pix recebido"}</Button></li>)}</ul>
    </section>
    <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="text-lg font-semibold">Clientes cadastrados</h2>
      {customers.isError && <p role="alert" className="text-destructive">{customers.error.message}</p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="py-2">Cliente</th><th>Situação</th><th>Teste até</th><th>Assinatura até</th><th>Espaços</th></tr></thead><tbody className="divide-y">{list.map(c=><tr key={c.owner_id}><td className="py-3"><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.email}</p></td><td>{({trial:"Teste 24h",active:"Ativa",expired:"Vencida",legacy:"Acesso anterior"} as Record<string,string>)[c.subscription_status]??c.subscription_status}</td><td>{formatDate(c.trial_ends_at)}</td><td>{formatDate(c.paid_until)}</td><td>{c.workspace_count}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
