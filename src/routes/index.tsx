import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meu Controle — finanças simples para você, seu trabalho e sua família" },
      { name: "description", content: "Saiba quanto entra, quanto sai, quanto deve e quanto pode guardar." },
      { property: "og:title", content: "Meu Controle" },
      { property: "og:description", content: "Saiba quanto entra, quanto sai, quanto deve e quanto pode guardar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-hero px-6 text-center text-primary-foreground">
      <h1 className="max-w-2xl text-4xl font-semibold md:text-6xl">Meu Controle</h1>
      <p className="mt-4 max-w-lg text-lg opacity-90">
        Saiba quanto entra, quanto sai, quanto deve e quanto pode guardar.
      </p>
      <Button variant="lime" size="lg" className="mt-8" asChild>
        <Link to="/inicio">Começar grátis</Link>
      </Button>
    </div>
  );
}
