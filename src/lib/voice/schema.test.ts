import { describe, it, expect } from "vitest";
import { validateVoiceDraft, type VoiceDraft } from "./schema";
const draft: VoiceDraft = { kind: "expense", amount_cents: 2000, description: "Alimentação", occurred_on: "2026-10-19", payment_method: "debit", account_id: "a", category_id: "c", card_id: null, installments: 1, paid: true };
const catalog = { accounts: [{ id: "a" }], categories: [{ id: "c", kind: "expense" }], cards: [{ id: "card" }] };
describe("rascunho por voz", () => {
  it("mantém R$20 como 2000 centavos no débito", () => expect(validateVoiceDraft(draft, catalog)).toEqual(draft));
  it("não aceita entidades de outro espaço ou categoria de outro tipo", () => {
    const result = validateVoiceDraft({ ...draft, account_id: "foreign", category_id: "foreign", card_id: "foreign" }, catalog);
    expect(result.account_id).toBeNull(); expect(result.category_id).toBeNull(); expect(result.card_id).toBeNull();
    expect(validateVoiceDraft({ ...draft, kind: "income" }, catalog).category_id).toBeNull();
  });
  it("não usa cartão para débito e rejeita centavos fracionados ou data inexistente", () => {
    const result = validateVoiceDraft({ ...draft, card_id: "card", amount_cents: 20.5, occurred_on: "2026-02-30" }, catalog);
    expect(result.card_id).toBeNull(); expect(result.amount_cents).toBeNull(); expect(result.occurred_on).toBeNull();
  });
});