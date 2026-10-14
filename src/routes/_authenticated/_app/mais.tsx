import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_app/mais")({
  head: () => ({ meta: [{ title: "Mais — Meu Controle" }] }),
  component: Mais,
});

function Mais() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Mais</h1>
      <Button variant="outline" className="w-full" asChild><Link to="/metas">Reserva e metas</Link></Button>
      <Button variant="outline" className="w-full" asChild><Link to="/contas">Contas e categorias</Link></Button>
      <Button variant="outline" className="w-full" asChild><Link to="/comecar">Novo espaço financeiro</Link></Button>
      <Button variant="destructive" className="w-full" onClick={signOut}>Sair</Button>
    </div>
  );
}
