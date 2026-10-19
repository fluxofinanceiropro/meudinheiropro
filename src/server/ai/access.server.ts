import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Surface = "transcription" | "interpretation";
export async function readAccessBlock(client: SupabaseClient<Database>, userId: string, surface: Surface): Promise<string | null> {
  const { data, error } = await client.from("voice_ai_access_states").select("message").eq("user_id", userId).eq("surface", surface).is("deleted_at", null).maybeSingle();
  if (error) throw new Error("Não foi possível verificar o acesso à IA.");
  return data?.message ?? null;
}
export function safeAiError(body: string): { message: string; type: string } {
  try {
    const data = JSON.parse(body) as { message?: string; type?: string; error?: { message?: string; type?: string } };
    return { message: data.error?.message ?? data.message ?? "Não foi possível processar a voz.", type: data.error?.type ?? data.type ?? "" };
  } catch { return { message: "Não foi possível processar a voz.", type: "" }; }
}
export async function persistProviderDenial(userId: string, surface: Surface, body: string): Promise<void> {
  const error = safeAiError(body);
  if (["credit_limit_reached", "model_requires_retention_consent", "model_vendor_not_enabled", "provider_not_available_in_region"].includes(error.type)) return;
  // Called only after a verified signed-in request receives an upstream 403.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin.from("voice_ai_access_states").upsert({ user_id: userId, surface, message: error.message, updated_at: new Date().toISOString() }, { onConflict: "user_id,surface" });
  if (result.error) throw new Error("O acesso à IA foi negado; não foi possível registrar o bloqueio.");
}