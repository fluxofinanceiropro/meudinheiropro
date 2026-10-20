import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { matchesStatement, statementCsv, type StatementFilter } from "@/lib/csv";
import { deliverFile } from "@/lib/download";
import type { Transaction } from "@/lib/queries";

export interface ExportStatementButtonProps { filter: StatementFilter; }
export function ExportStatementButton({ filter }: ExportStatementButtonProps) {
  const { workspace } = useWorkspace(); const [prepare, setPrepare] = useState(false);
  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["statement-export", workspace.id, filter], enabled: prepare, staleTime: 0,
    queryFn: async () => {
      const rows: Transaction[] = []; let offset = 0;
      while (true) {
        let query = supabase.from("transactions").select("id,kind,description,amount,occurred_on,status,payment_method,account_id,to_account_id,category_id,card_id,categories(name)")
          .eq("workspace_id", workspace.id).is("deleted_at", null).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
        if (filter.month) { const [y, m] = filter.month.split("-").map(Number); const next = new Date(y ?? 0, m ?? 1, 1); const end = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`; query = query.gte("occurred_on", `${filter.month}-01`).lt("occurred_on", end); }
        if (filter.startDate) query = query.gte("occurred_on", filter.startDate);
        if (filter.endDate) query = query.lte("occurred_on", filter.endDate);
        if (filter.kind !== "all") query = query.eq("kind", filter.kind);
        const result = await query; if (result.error) throw result.error;
        const page = result.data as Transaction[]; rows.push(...page.filter((t) => matchesStatement(t, filter)));
        if (page.length < 500) break; offset += 500;
      }
      const [a, c] = await Promise.all([supabase.from("accounts").select("id,name").eq("workspace_id", workspace.id), supabase.from("cards").select("id,name").eq("workspace_id", workspace.id)]);
      if (a.error) throw a.error; if (c.error) throw c.error;
      return { blob: new Blob([statementCsv(rows, new Map(a.data.map((item) => [item.id, item.name])), new Map(c.data.map((item) => [item.id, item.name])))], { type: "text/csv;charset=utf-8" }), count: rows.length };
    },
  });
  return <div className="flex flex-wrap items-center gap-2">
    <Button variant="outline" disabled={isFetching} onClick={() => {
      if (data && !isFetching) { void deliverFile(data.blob, `extrato-${filter.month ?? (filter.startDate ? `${filter.startDate}-a-${filter.endDate ?? "hoje"}` : "todos")}.csv`).catch(() => toast.error("Não foi possível baixar o extrato.")); }
      else if (isError) void refetch();
      else setPrepare(true);
    }}>{isFetching ? <LoaderCircle className="animate-spin" /> : <Download />}{data && !isFetching ? "Baixar CSV" : "Exportar CSV"}</Button>
    {data && !isFetching && <span className="text-xs text-muted-foreground">{data.count} movimentações</span>}
    {isError && <span role="alert" className="text-xs text-destructive">{error.message}</span>}
  </div>;
}