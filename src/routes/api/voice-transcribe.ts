import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const MAX_BODY = 10 * 1024 * 1024;
export const Route = createFileRoute("/api/voice-transcribe")({
  server: { handlers: { POST: async ({ request }) => {
    const json = (message: string, status: number) => Response.json({ message }, { status });
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return json("Origem inválida.", 403);
    const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
    if (!token || token.split(".").length !== 3) return json("Entre na sua conta para usar voz.", 401);
    const url = process.env['SUPABASE_URL']; const publishable = process.env['SUPABASE_PUBLISHABLE_KEY']; const key = process.env['LOVABLE_API_KEY'];
    if (!url || !publishable || !key) return json("O lançamento por voz ainda não está configurado.", 503);
    const client = createClient<Database>(url, publishable, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}`, apikey: publishable } } });
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) return json("Sua sessão expirou. Entre novamente.", 401);
    const { readAccessBlock, persistProviderDenial } = await import("@/server/ai/access.server");
    const blocked = await readAccessBlock(client, auth.user.id, "transcription");
    if (blocked) return json(blocked, 403);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return json("Envie uma gravação de áudio.", 400);
    if (Number(request.headers.get("content-length")) > MAX_BODY || !request.body) return json("Gravação muito grande.", 413);
    try {
      const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength;
        if (size > MAX_BODY) { await reader.cancel(); return json("Gravação muito grande.", 413); } chunks.push(chunk.value); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const form = await new Response(bytes, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
      const file = form.get("file"); const workspaceId = form.get("workspaceId");
      if (!(file instanceof File) || file.size < 2048 || !file.type.startsWith("audio/")) return json("Grave uma fala antes de enviar.", 400);
      if (typeof workspaceId !== "string" || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return json("Espaço inválido.", 400);
      const membership = await client.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", auth.user.id).maybeSingle();
      if (membership.error || !membership.data || membership.data.role === "viewer") return json("Você não tem permissão para adicionar movimentações.", 403);
      const { transcribe } = await import("@/server/ai/transcribe");
      const upstream = await transcribe({ baseURL: "https://ai.gateway.lovable.dev", apiKey: key, model: "openai/gpt-transcribe", maxFileBytes: MAX_BODY - 4096, audioOnly: true }, file, { signal: request.signal });
      if (upstream.status === 403) await persistProviderDenial(auth.user.id, "transcription", await upstream.clone().text());
      const { getLovableAiGatewayResponseHeaders } = await import("@/server/ai/run-id");
      const headers = getLovableAiGatewayResponseHeaders(upstream.headers, { "content-type": upstream.headers.get("content-type") ?? "text/event-stream", "cache-control": "no-cache, no-transform" });
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch { return json(request.signal.aborted ? "Cancelado." : "Não foi possível processar a gravação.", request.signal.aborted ? 499 : 500); }
  } } },
});