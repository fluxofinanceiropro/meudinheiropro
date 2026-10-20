import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Square, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/use-workspace";
import { interpretVoice } from "@/lib/voice.functions";
import { recordWav } from "@/lib/voice/record-wav";
import { readTranscript } from "@/lib/voice/transcript";
import { todayISO } from "@/lib/finance";
import type { VoiceDraft } from "@/lib/voice/schema";

export interface VoiceTransactionButtonProps { onDraft: (draft: VoiceDraft) => void; }
export function VoiceTransactionButton({ onDraft }: VoiceTransactionButtonProps) {
  const { workspace } = useWorkspace();
  const interpret = useServerFn(interpretVoice);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"idle" | "starting" | "recording" | "transcribing" | "interpreting">("idle");
  const [text, setText] = useState(""); const [error, setError] = useState("");
  const recorder = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancel() {
    generation.current += 1; abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    const active = recorder.current; recorder.current = null;
    if (active) void active.stop().catch(() => undefined);
    setStage("idle");
  }
  useEffect(() => () => { generation.current += 1; abort.current?.abort(); if (timer.current) clearTimeout(timer.current); void recorder.current?.stop().catch(() => undefined); }, []);
  useEffect(() => {
    generation.current += 1; abort.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    const active = recorder.current; recorder.current = null;
    if (active) void active.stop().catch(() => undefined);
    setStage("idle"); setOpen(false);
  }, [workspace.id]);
  async function start() {
    const current = ++generation.current; setText(""); setError(""); setStage("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador não permite gravar áudio. Use o lançamento manual.");
      const active = await recordWav();
      if (current !== generation.current) { await active.stop(); return; }
      recorder.current = active; setStage("recording");
      timer.current = setTimeout(() => { void finish(); }, 60_000);
    } catch (e) { if (current === generation.current) { setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Permita o microfone no navegador para gravar." : e instanceof Error ? e.message : "Não foi possível abrir o microfone."); setStage("idle"); } }
  }
  async function finish() {
    const active = recorder.current; if (!active) return;
    recorder.current = null; if (timer.current) clearTimeout(timer.current);
    const current = generation.current; const controller = new AbortController(); abort.current = controller;
    setStage("transcribing");
    try {
      const file = await active.stop();
      if (current !== generation.current) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Entre na sua conta para usar voz.");
      const form = new FormData(); form.append("file", file); form.append("workspaceId", workspace.id);
      const response = await fetch("/api/voice-transcribe", { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` }, body: form, signal: controller.signal });
      const transcript = await readTranscript(response, setText);
      if (current !== generation.current) return;
      setStage("interpreting");
      const result = await interpret({ data: { transcript, workspaceId: workspace.id, today: todayISO() }, signal: controller.signal });
      if (current !== generation.current) return;
      if (result.error || !result.draft) throw new Error(result.error ?? "Nenhuma movimentação foi reconhecida.");
      setOpen(false); setStage("idle"); onDraft(result.draft);
    } catch (e) { if (current === generation.current) { setError(e instanceof Error ? e.message : "Não foi possível processar a voz."); setStage("idle"); } }
  }
  const busy = stage !== "idle" && stage !== "recording";
  return <>
    <Button variant="outline" className="mt-2 border-sidebar-foreground/35 bg-sidebar-foreground/10 font-semibold text-sidebar-foreground hover:bg-sidebar-foreground/20 hover:text-sidebar-foreground" onClick={() => { setError(""); setText(""); setOpen(true); }}><Mic /> Lançar por voz</Button>
    <Dialog open={open} onOpenChange={(value) => { if (!value) cancel(); setOpen(value); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Lançar por voz</DialogTitle><DialogDescription>Gravação de uma movimentação</DialogDescription></DialogHeader>
        <p aria-live="polite" className="text-sm text-muted-foreground">{stage === "recording" ? "Ouvindo…" : stage === "transcribing" ? "Transcrevendo…" : stage === "interpreting" ? "Interpretando…" : "Pronto para gravar"}</p>
        {text && <p className="break-words text-sm">{text}</p>}
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
        <Button disabled={busy} onClick={() => { if (stage === "recording") void finish(); else void start(); }}>
          {busy ? <LoaderCircle className="animate-spin" /> : stage === "recording" ? <Square /> : <Mic />}
          {busy ? "Processando…" : stage === "recording" ? "Concluir gravação" : "Gravar"}
        </Button>
        <Button variant="ghost" onClick={() => { cancel(); setOpen(false); }}>Cancelar</Button>
      </DialogContent>
    </Dialog>
  </>;
}