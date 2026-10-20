import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Home, ArrowLeftRight, CreditCard, Menu, Plus, LogOut, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { AddTransactionDialog } from "./AddTransactionDialog";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { Button } from "@/components/ui/button";
import { VoiceTransactionButton } from "./VoiceTransactionButton";
import { ProfileAvatar, profileQuery } from "./ProfileSettings";
import { useQuery } from "@tanstack/react-query";
import type { VoiceDraft } from "@/lib/voice/schema";

const NAV = [
  { to: "/inicio", label: "Início", icon: Home },
  { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
  { to: "/cartoes", label: "Cartões", icon: CreditCard },
  { to: "/mais", label: "Mais", icon: Menu },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);
  const [prefill, setPrefill] = useState<VoiceDraft | null>(null);
  function voiceDraft(draft: VoiceDraft) { setPrefill(draft); setAddOpen(true); }
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useQuery(profileQuery());

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar p-5 text-sidebar-foreground md:flex md:sticky md:top-0 md:h-screen">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Wallet className="size-5" />
          </div>
          <span className="font-display text-lg font-semibold">Meu Controle</span>
        </div>
        <Link to="/mais" className="mb-4 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-sidebar-accent" aria-label="Editar meu perfil">
          <ProfileAvatar /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{profile?.name || "Meu perfil"}</span><span className="block text-xs opacity-65">Editar meu perfil</span></span>
        </Link>
        <WorkspaceSwitcher variant="sidebar" />
        <Button variant="lime" className="mt-6" onClick={() => { setPrefill(null); setAddOpen(true); }}>
          <Plus /> Adicionar
        </Button>
        <VoiceTransactionButton onDraft={voiceDraft} />
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"
        >
          <LogOut className="size-4" /> Sair
        </button>
      </aside>

      <div className="flex-1 pb-28 md:pb-10">
        <header className="flex items-center justify-between px-4 pt-5 md:hidden">
          <WorkspaceSwitcher variant="mobile" />
          <Link to="/mais" aria-label="Abrir meu perfil"><ProfileAvatar size="h-9 w-9" /></Link>
          <VoiceTransactionButton onDraft={voiceDraft} />
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-8">{children}</main>
      </div>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5 items-end">
          {NAV.slice(0, 2).map((item) => (
            <BottomLink key={item.to} {...item} />
          ))}
          <div className="flex justify-center">
            <button
              aria-label="Adicionar movimentação"
              onClick={() => { setPrefill(null); setAddOpen(true); }}
              className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft ring-4 ring-background"
            >
              <Plus className="size-6" />
            </button>
          </div>
          {NAV.slice(2).map((item) => (
            <BottomLink key={item.to} {...item} />
          ))}
        </div>
      </nav>

      <AddTransactionDialog open={addOpen} onOpenChange={setAddOpen} prefill={prefill} />
    </div>
  );
}

function BottomLink({ to, label, icon: Icon }: (typeof NAV)[number]) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground"
      activeProps={{ className: "text-primary" }}
    >
      <Icon className="size-5" />
      {label === "Movimentações" ? "Extrato" : label}
    </Link>
  );
}
