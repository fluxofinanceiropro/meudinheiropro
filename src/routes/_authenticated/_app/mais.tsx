import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { ProfileSettings } from "@/components/app/ProfileSettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/_app/mais")({
  head: () => ({ meta: [{ title: "Mais — Meu Controle" }] }),
  component: Mais,
});

type Member = { id: string; user_id: string; name: string; email: string; role: string };
type MembersResponse = { members: Member[]; canInvite: boolean };
type InviteRole = "editor" | "viewer";
const roleLabel: Record<string, string> = {
  owner: "Proprietário", editor: "Editor", viewer: "Visualizador",
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Mais() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const [dialog, setDialog] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("editor");
  const [sending, setSending] = useState(false);

  const members = useQuery({
    queryKey: ["workspace-members", workspace.id],
    queryFn: async (): Promise<MembersResponse> => {
      const { data, error } = await supabase.functions.invoke("workspace-members", {
        body: { action: "list", workspaceId: workspace.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as MembersResponse;
    },
    retry: 1,
  });

  async function invite() {
    const normalized = email.trim().toLowerCase();
    if (!emailPattern.test(normalized)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("workspace-members", {
        body: { action: "invite", workspaceId: workspace.id, email: normalized, role, redirectTo: window.location.origin + "/inicio" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.emailSent ? "Convite enviado por e-mail!" : "Acesso liberado para este membro!");
      setDialog(false);
      setEmail("");
      setRole("editor");
      await qc.invalidateQueries({ queryKey: ["workspace-members", workspace.id] });
    } catch (err) {
      toast.error((err as Error).message || "Não foi possível convidar.");
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mais</h1>
      <ProfileSettings />
      <Button variant="outline" className="w-full" asChild><Link to="/metas">Reserva e metas</Link></Button>
      <Button variant="outline" className="w-full" asChild><Link to="/relatorios">Relatórios</Link></Button>
      <Button variant="outline" className="w-full" asChild><Link to="/assinatura">Minha assinatura</Link></Button>
      <Button variant="outline" className="w-full" asChild><Link to="/contas">Contas e categorias</Link></Button>
      <Button variant="outline" className="w-full" asChild><Link to="/comecar">Novo espaço financeiro</Link></Button>

      <section className="space-y-3 rounded-2xl border bg-card p-4" aria-labelledby="members-title">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 id="members-title" className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5" /> Membros</h2>
            <p className="text-xs text-muted-foreground">Compartilhe {workspace.name} com sua família, cada pessoa com seu próprio login</p>
          </div>
          {members.data?.canInvite && (
            <Button size="sm" onClick={() => setDialog(true)}><Plus className="mr-1 h-4 w-4" /> Convidar</Button>
          )}
        </div>
        {members.isPending && <p className="text-sm text-muted-foreground">Carregando membros…</p>}
        {members.isError && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">Não foi possível carregar os membros. Verifique se a função workspace-members foi publicada.</p>
            <Button size="sm" variant="outline" onClick={() => members.refetch()}>Tentar novamente</Button>
          </div>
        )}
        {members.data && (
          <ul className="divide-y">
            {members.data.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.name || member.email || "Membro"}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs">{roleLabel[member.role] ?? member.role}</span>
              </li>
            ))}
            {!members.data.members.length && <li className="py-3 text-sm text-muted-foreground">Nenhum membro encontrado.</li>}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Editor pode cadastrar e alterar informações. Visualizador possui acesso somente para consulta.</p>
      </section>

      <Button variant="destructive" className="w-full" onClick={signOut}>Sair</Button>

      <Dialog open={dialog} onOpenChange={(open) => !sending && setDialog(open)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar novo membro</DialogTitle></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void invite(); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">E-mail</Label>
              <Input id="member-email" type="email" required autoComplete="email" placeholder="pessoa@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Permissão</Label>
              <Select value={role} onValueChange={(value) => setRole(value as InviteRole)}>
                <SelectTrigger id="member-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor — pode alterar informações</SelectItem>
                  <SelectItem value="viewer">Visualizador — somente leitura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground"><Mail className="mt-0.5 h-4 w-4 shrink-0" /> Novos usuários receberão um e-mail para entrar. Quem já possui conta terá acesso liberado diretamente.</p>
            <DialogFooter><Button type="submit" disabled={sending}>{sending ? "Enviando…" : "Enviar convite"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
