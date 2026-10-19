import { createParser } from "eventsource-parser";

export async function readTranscript(response: Response, onText: (text: string) => void): Promise<string> {
  if (!response.ok) {
    let message = "Não foi possível transcrever a gravação.";
    try { const error = await response.json() as { message?: string; error?: { message?: string } }; message = error.error?.message ?? error.message ?? message; } catch { /* keep safe message */ }
    throw new Error(message);
  }
  if (!response.body) throw new Error("A transcrição veio vazia.");
  let text = ""; let done = false; let failure: string | null = null;
  const parser = createParser({ onEvent(event) {
    if (event.data === "[DONE]") return;
    const data = JSON.parse(event.data) as { type?: string; delta?: string; text?: string; message?: string; error?: { message?: string } };
    const type = data.type ?? event.event;
    if (type === "transcript.text.delta") { text += data.delta ?? ""; onText(text); }
    if (type === "transcript.text.done") { text = data.text ?? text; done = true; onText(text); }
    if (type === "error" || data.error) failure = data.error?.message ?? data.message ?? "Falha na transcrição.";
  } });
  const reader = response.body.getReader(); const decoder = new TextDecoder();
  try { while (true) { const chunk = await reader.read(); if (chunk.done) break; parser.feed(decoder.decode(chunk.value, { stream: true })); } parser.feed(decoder.decode()); }
  finally { reader.releaseLock(); }
  if (failure) throw new Error(failure);
  if (!done || !text.trim()) throw new Error("Não foi possível ouvir uma fala completa. Nenhum lançamento foi salvo.");
  return text;
}