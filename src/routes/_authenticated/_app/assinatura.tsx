import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Crown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/assinatura")({
 head: () => ({ meta: [{ title: "Minha assinatura — Meu Dinheiro Pro" }] }),
 component: Subscription,
});
function Subscription() {
 return <div className="mx-auto max-w-xl space-y-5">
  <Button asChild variant="ghost" size="sm"><Link to="/mais"><ArrowLeft className="mr-2 h-4 w-4"/>Voltar para Mais</Link></Button>
  <h1 className="flex items-center gap-2 text-2xl font-semibold"><Crown className="h-6 w-6"/>Minha assinatura</h1>
  <section className="space-y-3 rounded-2xl border bg-card p-5">
   <p className="text-sm text-muted-foreground">Plano mensal previsto</p>
   <p className="font-display text-3xl font-semibold">R$ 9,90 <span className="text-sm font-normal text-muted-foreground">/ 30 dias</span></p>
   <div className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0"/><p>O sistema de cobranças está sendo preparado. A ativação, o vencimento e a renovação ainda não estão disponíveis nesta versão; não faça pagamentos por esta tela.</p></div>
  </section>
 </div>;
}
