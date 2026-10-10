import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const workspacesQuery = () =>
  queryOptions({
    queryKey: ["workspaces"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("id,name,kind")
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const balancesQuery = (ws: string) =>
  queryOptions({
    queryKey: ["balances", ws],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_balances")
        .select("*")
        .eq("workspace_id", ws)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

export const categoriesQuery = (ws: string) =>
  queryOptions({
    queryKey: ["categories", ws],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,kind")
        .eq("workspace_id", ws)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

export const transactionsQuery = (ws: string) =>
  queryOptions({
    queryKey: ["transactions", ws],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id,kind,description,amount,occurred_on,status,payment_method,account_id,to_account_id,category_id,categories(name)",
        )
        .eq("workspace_id", ws)
        .is("deleted_at", null)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

export type Transaction = Awaited<ReturnType<NonNullable<ReturnType<typeof transactionsQuery>["queryFn"]>>>[number];
