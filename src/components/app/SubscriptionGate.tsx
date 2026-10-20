import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, LockKeyhole, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const PIX_KEY = "62109951000150";
type Status = { status: "trial" | "active" | "expired"; trial_ends_at: string; paid_until: string | null };

export function SubscriptionGate({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);
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
      const { error } = await supabase.from("saas_payment_requests").insert({ owner_id: auth.user.id });
      if (error && error.code !== "23505") throw error;
      toast.success("Solicitação registrada! Após pagar, aguarde a confirmação.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSending(false); }
  }

  if (access.isPending) return <p className="p-8 text-center text-muted-foreground">Verificando assinatura…</p>;
  if (access.isError) return <div className="mx-auto max-w-lg space-y-3 p-8"><p role="alert">Não foi possível verificar sua assinatura. Nenhum dado foi alterado.</p><Button onClick={() => access.refetch()}>Tentar novamente</Button></div>;
  if (access.data.status !== "expired") return <>{children}</>;

  return <div className="mx-auto max-w-lg space-y-5 p-6">
    <div className="flex items-center gap-3"><LockKeyhole className="h-8 w-8 text-primary" /><div><h1 className="text-2xl font-bold">Seu teste de 24 horas terminou</h1><p className="text-muted-foreground">Seus dados estão salvos. Assine para continuar utilizando seu espaço financeiro.</p></div></div>
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <p className="font-semibold">Meu Dinheiro Pro — Plano mensal</p>
      <p className="text-3xl font-bold">R$ 9,90 <span className="text-sm font-normal text-muted-foreground">/ 30 dias</span></p>
      <p className="text-sm text-muted-foreground">Pagamento via Pix — chave CNPJ</p>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3">
        <code className="font-semibold">{PIX_KEY}</code>
        <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(PIX_KEY); toast.success("Chave Pix copiada!"); } catch { toast.error("Copie o CNPJ manualmente."); } }}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
      </div>
      <p className="text-sm">Faça o Pix de <strong>R$ 9,90</strong> para o CNPJ acima. Confira o nome do recebedor no seu banco antes de pagar.</p>
      <Button className="w-full" onClick={() => void requestPayment()} disabled={sending}><CreditCard className="mr-2 h-4 w-4" />{sending ? "Registrando…" : "Já paguei — solicitar conferência"}</Button>
      <p className="text-xs text-muted-foreground">O acesso será liberado somente após a confirmação manual do recebimento. Este botão não confirma o pagamento.</p>
      <Button variant="outline" className="w-full" onClick={() => qc.invalidateQueries({ queryKey: ["subscription", workspaceId] })}>Verificar liberação</Button>
    </div>
  </div>;
}
