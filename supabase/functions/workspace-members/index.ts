import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !key || !anonKey) return json({ error: "Configuração do servidor incompleta." }, 500);
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Faça login para continuar." }, 401);
    const requester = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: auth, error: authError } = await requester.auth.getUser();
    if (authError || !auth.user) return json({ error: "Sessão inválida." }, 401);

    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const body = await req.json();
    const { action, workspaceId } = body;
    if (typeof workspaceId !== "string" || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return json({ error: "Espaço inválido." }, 400);
    const { data: workspace, error: wsError } = await admin.from("workspaces").select("id,name,owner_id").eq("id", workspaceId).is("deleted_at", null).maybeSingle();
    if (wsError) throw wsError;
    if (!workspace) return json({ error: "Espaço não encontrado." }, 404);
    const owner = workspace.owner_id === auth.user.id;
    const { data: membership, error: memberError } = await admin.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", auth.user.id).maybeSingle();
    if (memberError) throw memberError;
    if (!owner && !membership) return json({ error: "Sem acesso a este espaço." }, 403);

    if (action === "list") {
      const { data: rows, error } = await admin.from("workspace_members").select("id,user_id,role").eq("workspace_id", workspaceId).order("created_at");
      if (error) throw error;
      const ids = [...new Set([workspace.owner_id, ...(rows ?? []).map((m) => m.user_id)])];
      const { data: profiles, error: profileError } = await admin.from("profiles").select("id,full_name").in("id", ids);
      if (profileError) throw profileError;
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      const members = [];
      for (const id of ids) {
        const { data: userData, error: userError } = await admin.auth.admin.getUserById(id);
        if (userError) throw userError;
        const record = rows?.find((m) => m.user_id === id);
        members.push({ id: record?.id ?? id, user_id: id, name: profileMap.get(id) ?? "", email: userData.user?.email ?? "", role: id === workspace.owner_id ? "owner" : (record?.role ?? "viewer") });
      }
      return json({ members, canInvite: owner });
    }

    if (action === "invite") {
      if (!owner) return json({ error: "Apenas o proprietário pode convidar." }, 403);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const role = body.role;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "E-mail inválido." }, 400);
      if (role !== "editor" && role !== "viewer") return json({ error: "Permissão inválida." }, 400);
      if (email === auth.user.email?.toLowerCase()) return json({ error: "Você já é o proprietário deste espaço." }, 409);

      // Resolve existing users first: Supabase Auth cannot send inviteUserByEmail to an existing identity.
      let existingId: string | undefined;
      for (let page = 1; page <= 100; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        existingId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
        if (existingId || data.users.length < 1000) break;
      }
      if (existingId) {
        const { data: prior, error } = await admin.from("workspace_members").select("id").eq("workspace_id", workspaceId).eq("user_id", existingId).maybeSingle();
        if (error) throw error;
        if (prior) return json({ error: "Esta pessoa já é membro deste espaço." }, 409);
        const { error: insertError } = await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: existingId, role });
        if (insertError) throw insertError;
        return json({ emailSent: false });
      }

      const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : "";
      // Redirect only to the origin in the configured allow-list. Invalid URLs are not forwarded.
      let safeRedirect: string | undefined;
      try {
        const requested = new URL(redirectTo);
        const allowed = (Deno.env.get("INVITE_ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim());
        if (requested.protocol === "https:" && allowed.includes(requested.origin)) safeRedirect = requested.origin + "/inicio";
      } catch { /* fall back to project Auth URL */ }
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        ...(safeRedirect ? { redirectTo: safeRedirect } : {}),
      });
      if (inviteError) throw inviteError;
      if (!invited.user) return json({ error: "Não foi possível criar o convite." }, 500);
      const { error: insertError } = await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: invited.user.id, role });
      if (insertError) {
        // An invitation email may already be sent; report the failure rather than pretending membership exists.
        throw insertError;
      }
      return json({ emailSent: true });
    }
    return json({ error: "Ação inválida." }, 400);
  } catch (err) {
    console.error("workspace-members:", err);
    return json({ error: "Não foi possível concluir a operação. Tente novamente." }, 500);
  }
});
