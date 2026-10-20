import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, LockKeyhole, Copy, MessageCircle, Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const PIX_KEY = "62109951000150";
const WHATSAPP = "5537996620552";
const plans = { monthly: { label: "Mensal", amount: 9.90, period: "30 dias" }, annual: { label: "Anual", amount: 97, period: "1 ano" } } as const;
type PlanKey = keyof typeof plans;
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const receiptUrl = (plan: PlanKey) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Olá! Quero enviar o comprovante do plano ${plans[plan].label} de ${money(plans[plan].amount)} do Meu Dinheiro Pro.`)}`;
export function formatRemaining(target: string, now: number) {
  const seconds = Math.max(0, Math.ceil((new Date(target).getTime() - now) / 1000));
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), sec = seconds % 60;
  return [h, m, sec].map(x => String(x).padStart(2, "0")).join(":");
}
type Status = { status: "trial" | "active" | "expired"; trial_ends_at: string; paid_until: string | null };

export function SubscriptionGate({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
  const [plan, setPlan] = useState<PlanKey>("monthly");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const access = useQuery({
    queryKey: ["subscription", workspaceId],
    queryFn: async (): Promise<Status> => {
      const { data, error } = await supabase.rpc("my_saas_status", { _workspace: workspaceId });
      if (error) throw error;
      const entry = data?.[0];
      if (!entry) throw new Error("Não foi possível consultar sua assinatura.");
      return entry as Status;
    },
    refetchInterval: 30_000,
    staleTime: 0,
    retry: 1,
  });

  async function requestPayment() {
    setSending(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError || new Error("Faça login novamente.");
      const { error } = await supabase.from("saas_payment_requests").insert({ owner_id: auth.user.id, plan_code: plan, amount: plans[plan].amount });
      if (error?.code === "23505") throw new Error("Você já possui uma solicitação pendente. Aguarde a confirmação pelo administrador antes de pedir outro plano.");
      if (error) throw error;
      toast.success("Solicitação registrada! Envie o comprovante pelo WhatsApp para conferência.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSending(false); }
  }

  if (access.isPending) return <p className="p-8 text-center text-muted-foreground">Verificando assinatura…</p>;
  if (access.isError) return <div className="mx-auto max-w-lg space-y-3 p-8"><p role="alert">Não foi possível verificar sua assinatura. Nenhum dado foi alterado.</p><Button onClick={() => access.refetch()}>Tentar novamente</Button></div>;
  const isTrial = access.data.status === "trial" && new Date(access.data.trial_ends_at).getTime() > now;
  if (access.data.status === "active") return <>{children}</>;
  if (isTrial) return <>
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-2 border-b bg-amber-50 px-3 py-2 text-center text-sm text-amber-950">
      <Clock3 className="h-4 w-4" aria-hidden="true" />
      <span>Seu teste grátis termina em <strong className="tabular-nums">{formatRemaining(access.data.trial_ends_at, now)}</strong></span>
      <span className="text-xs">Após o teste: mensal R$ 9,90 ou anual R$ 97,00</span>
    </div>
    {children}
  </>;

  return <div className="mx-auto max-w-lg space-y-5 p-6">
    <div className="flex items-center gap-3"><LockKeyhole className="h-8 w-8 text-primary" /><div><h1 className="text-2xl font-bold">Seu teste de 24 horas terminou</h1><p className="text-muted-foreground">Seus dados estão salvos. Assine para continuar utilizando seu espaço financeiro.</p></div></div>
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <p className="font-semibold">Escolha seu plano</p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(plans) as PlanKey[]).map(key => <button key={key} type="button" aria-pressed={plan === key} onClick={() => setPlan(key)} className={`rounded-xl border p-3 text-left ${plan === key ? "border-primary bg-primary/10" : ""}`}>
          <span className="block text-sm font-medium">{plans[key].label}</span>
          <strong className="block text-xl">{money(plans[key].amount)}</strong>
          <span className="text-xs text-muted-foreground">{plans[key].period}</span>
        </button>)}
      </div>
      <p className="text-sm text-muted-foreground">Pagamento via Pix — chave CNPJ</p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
        <code className="font-semibold">{PIX_KEY}</code>
        <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(PIX_KEY); toast.success("Chave Pix copiada!"); } catch { toast.error("Copie o CNPJ manualmente."); } }}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
      </div>
      <p className="text-sm">Faça o Pix de <strong>{money(plans[plan].amount)}</strong> para o CNPJ acima. Confira o nome do recebedor no seu banco antes de pagar.</p>
      <a href={receiptUrl(plan)} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-accent">
        <MessageCircle className="h-4 w-4" />Enviar comprovante pelo WhatsApp · (37) 99662-0552
      </a>
      <Button className="w-full" onClick={() => void requestPayment()} disabled={sending}><CreditCard className="mr-2 h-4 w-4" />{sending ? "Registrando…" : "Já paguei — solicitar conferência"}</Button>
      <p className="text-xs text-muted-foreground">O acesso por {plans[plan].period} só será liberado após o administrador conferir o Pix recebido e confirmar no painel. Este botão não confirma o pagamento.</p>
      <Button variant="outline" className="w-full" onClick={() => qc.invalidateQueries({ queryKey: ["subscription", workspaceId] })}>Verificar liberação</Button>
    </div>
  </div>;
}
