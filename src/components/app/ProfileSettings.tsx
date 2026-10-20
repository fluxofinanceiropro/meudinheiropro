import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LoaderCircle, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BUCKET = "profile-photos";
export const profileQuery = () => ({
  queryKey: ["my-profile"],
  queryFn: async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error("Faça login novamente.");
    const { data, error } = await supabase.from("profiles").select("full_name,avatar_url").eq("id", auth.user.id).maybeSingle();
    if (error) throw error;
    return { id: auth.user.id, email: auth.user.email || "", name: data?.full_name || auth.user.user_metadata?.full_name || "", avatar: data?.avatar_url || "" };
  },
  staleTime: 60_000,
});
export function ProfileAvatar({ size = "h-10 w-10" }: { size?: string }) {
  const { data } = useQuery(profileQuery());
  return <span className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-accent text-sidebar-foreground`}>
    {data?.avatar ? <img src={data.avatar} alt="Sua foto de perfil" className="h-full w-full object-cover" /> : <UserRound className="h-1/2 w-1/2" aria-hidden="true" />}
  </span>;
}
export function ProfileSettings() {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery(profileQuery());
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setName(data.name); }, [data]);

  async function saveName() {
    if (!data) return;
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 80) { toast.error("Digite um nome entre 2 e 80 caracteres."); return; }
    setSaving(true);
    try {
      const { error, data: updated } = await supabase.from("profiles")
        .upsert({ id: data.id, full_name: clean }, { onConflict: "id" }).select("id");
      if (error) throw error;
      if (!updated?.length) throw new Error("Não foi possível salvar seu nome.");
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Nome atualizado!");
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function uploadPhoto(file?: File) {
    if (!file || !data) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Escolha uma foto JPG, PNG ou WebP."); return;
    }
    if (file.size > 2 * 1024 * 1024) { toast.error("A foto deve ter até 2 MB."); return; }
    setSaving(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const objectPath = `${data.id}/avatar-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: url } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      const { error: profileError, data: updated } = await supabase.from("profiles")
        .upsert({ id: data.id, avatar_url: url.publicUrl }, { onConflict: "id" }).select("id");
      if (profileError || !updated?.length) {
        await supabase.storage.from(BUCKET).remove([objectPath]);
        throw profileError || new Error("Não foi possível salvar a foto.");
      }
      await qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Foto atualizada!");
    } catch (err) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  return <section className="space-y-4 rounded-2xl border bg-card p-4">
    <h2 className="text-lg font-semibold">Meu perfil</h2>
    {isPending && <p className="text-sm text-muted-foreground">Carregando perfil…</p>}
    {error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar o perfil: {error.message}</p>}
    {data && <>
      <div className="flex items-center gap-4">
        <ProfileAvatar size="h-20 w-20" />
        <div className="space-y-1">
          <Label htmlFor="profile-photo" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <Camera className="h-4 w-4" /> Trocar foto
          </Label>
          <input id="profile-photo" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={(event) => { void uploadPhoto(event.target.files?.[0]); event.target.value = ""; }} />
          <p className="text-xs text-muted-foreground">JPG, PNG ou WebP • até 2 MB</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Nome de exibição</Label>
        <Input id="profile-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" disabled={saving} />
      </div>
      <div className="space-y-1.5">
        <Label>E-mail da conta</Label>
        <p className="text-sm text-muted-foreground">{data.email}</p>
      </div>
      <Button onClick={() => void saveName()} disabled={saving || name.trim() === data.name}>
        {saving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Salvando…</> : "Salvar nome"}
      </Button>
    </>}
  </section>;
}
