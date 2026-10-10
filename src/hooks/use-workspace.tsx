import { createContext, useContext, type ReactNode } from "react";

export interface Workspace {
  id: string;
  name: string;
  kind: string;
}

interface Ctx {
  workspace: Workspace;
  workspaces: Workspace[];
  setWorkspaceId: (id: string) => void;
}

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace fora do WorkspaceProvider");
  return ctx;
}

export const WS_STORAGE_KEY = "meucontrole.workspace";

export const KIND_LABEL: Record<string, string> = {
  personal: "Pessoal",
  freelancer: "Autônomo",
  family: "Família",
};
