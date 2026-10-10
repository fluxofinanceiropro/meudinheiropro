import { Link } from "@tanstack/react-router";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace, KIND_LABEL } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({ variant }: { variant: "sidebar" | "mobile" }) {
  const { workspace, workspaces, setWorkspaceId } = useWorkspace();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "sidebar" ? "w-full bg-sidebar-accent px-3 py-2.5" : "py-1",
        )}
      >
        <div className="min-w-0 flex-1">
          {variant === "sidebar" && (
            <p className="text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
              {KIND_LABEL[workspace.kind]}
            </p>
          )}
          <p className={cn("truncate font-semibold", variant === "mobile" && "font-display text-lg")}>
            {workspace.name}
          </p>
        </div>
        <ChevronsUpDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onSelect={() => setWorkspaceId(w.id)}>
            <div className="flex-1">
              <p className="font-medium">{w.name}</p>
              <p className="text-xs text-muted-foreground">{KIND_LABEL[w.kind]}</p>
            </div>
            {w.id === workspace.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/comecar">
            <Plus className="size-4" /> Novo espaço
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
