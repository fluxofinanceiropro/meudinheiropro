import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/cartoes")({
  head: () => ({ meta: [{ title: "Cartões — Meu Controle" }] }),
  component: () => (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Cartões</h1>
      <p className="text-muted-foreground">Faturas, parcelas e limites chegam na próxima etapa.</p>
    </div>
  ),
});
