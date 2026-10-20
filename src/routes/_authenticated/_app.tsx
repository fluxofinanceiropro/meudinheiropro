import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { workspacesQuery } from "@/lib/queries";
import { WorkspaceProvider, WS_STORAGE_KEY } from "@/hooks/use-workspace";
import { AppShell } from "@/components/app/AppShell";
import { SubscriptionGate } from "@/components/app/SubscriptionGate";

export const Route = createFileRoute("/_authenticated/_app")({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspacesQuery()),
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>
  ),
  component: AppLayout,
});

function AppLayout() {
  const { data: workspaces } = useSuspenseQuery(workspacesQuery());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setSelected(localStorage.getItem(WS_STORAGE_KEY));
  }, []);

  const workspace = workspaces.find((w) => w.id === selected) ?? workspaces[0];
  if (!workspace) return <Navigate to="/comecar" replace />;
  const setWorkspaceId = (id: string) => {
    localStorage.setItem(WS_STORAGE_KEY, id);
    setSelected(id);
  };

  return (
    <WorkspaceProvider value={{ workspace, workspaces, setWorkspaceId }}>
      <AppShell>
        <SubscriptionGate workspaceId={workspace.id}><Outlet /></SubscriptionGate>
      </AppShell>
    </WorkspaceProvider>
  );
}
