import { describe, it, expect } from "vitest";
import { readTranscript } from "./transcript";
describe("transcrição em fluxo", () => {
  it("recompõe eventos SSE separados e usa texto final", async () => {
    const encoded = new TextEncoder().encode('data: {"type":"transcript.text.delta","delta":"Gastei "}\n\ndata: {"type":"transcript.text.done","text":"Gastei vinte reais"}\n\n');
    const response = new Response(new ReadableStream({ start(c) { for (let i = 0; i < encoded.length; i += 7) c.enqueue(encoded.slice(i, i + 7)); c.close(); } }));
    expect(await readTranscript(response, () => undefined)).toBe("Gastei vinte reais");
  });
  it("encerra com a mensagem segura de erro sem fingir sucesso", async () => {
    await expect(readTranscript(Response.json({ message: "Créditos insuficientes" }, { status: 402 }), () => undefined)).rejects.toThrow("Créditos insuficientes");
    await expect(readTranscript(new Response('data: {"type":"transcript.text.delta","delta":"Gastei"}\n\n'), () => undefined)).rejects.toThrow("fala completa");
  });
});