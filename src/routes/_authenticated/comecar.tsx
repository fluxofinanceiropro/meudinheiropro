import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseBRL, centsToDecimal } from "@/lib/money";
import { WS_STORAGE_KEY } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comecar")({
  head: () => ({ meta: [{ title: "Novo espaço — Meu Controle" }] }),
  component: Onboarding,
});

const KINDS = [
  { v: "personal", l: "Pessoal", d: "Minhas finanças" },
  { v: "freelancer", l: "Autônomo", d: "Meu trabalho" },
  { v: "family", l: "Família", d: "Nossa casa" },
];

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [kind, setKind] = useState("personal");
  const [name, setName] = useState("Minhas finanças");
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = balance ? parseBRL(balance) : 0;
    if (cents === null) return toast.error("Saldo inválido");
    setBusy(true);
    const { data, error } = await supabase.rpc("create_workspace", {
      _name: name, _kind: kind, _initial_balance: Number(centsToDecimal(cents)),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    localStorage.setItem(WS_STORAGE_KEY, data as string);
    await qc.invalidateQueries({ queryKey: ["workspaces"] });
    navigate({ to: "/inicio" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl bg-card p-6 shadow-soft">
        <h1 className="text-2xl font-semibold">Crie seu espaço financeiro</h1>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button type="button" key={k.v}
              onClick={() => { setKind(k.v); setName(k.d); }}
              className={cn("rounded-xl border p-3 text-sm font-medium", kind === k.v && "border-primary bg-secondary")}>
              {k.l}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="n">Nome do espaço</Label>
          <Input id="n" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="b">Saldo inicial (R$)</Label>
          <Input id="b" inputMode="decimal" placeholder="0,00" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>Começar</Button>
      </form>
    </div>
  );
}
