import { z } from "zod";

export const voiceDraftSchema = z.object({
  kind: z.enum(["expense", "income"]).nullable(),
  amount_cents: z.number().nullable(),
  description: z.string().nullable(),
  occurred_on: z.string().nullable(),
  payment_method: z.enum(["pix", "debit", "credit_card", "cash", "boleto", "transfer", "other"]).nullable(),
  account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  card_id: z.string().nullable(),
  installments: z.number().nullable(),
  paid: z.boolean().nullable(),
});
export type VoiceDraft = z.infer<typeof voiceDraftSchema>;

interface CatalogItem { id: string; }
export function validateVoiceDraft(draft: VoiceDraft, catalog: {
  accounts: CatalogItem[]; categories: Array<CatalogItem & { kind: string }>; cards: CatalogItem[];
}): VoiceDraft {
  const has = (items: CatalogItem[], id: string | null) => id !== null && items.some((item) => item.id === id);
  return {
    ...draft,
    amount_cents: draft.amount_cents !== null && Number.isSafeInteger(draft.amount_cents) && draft.amount_cents > 0 ? draft.amount_cents : null,
    description: draft.description?.trim().slice(0, 120) || null,
    occurred_on: draft.occurred_on && /^\d{4}-\d{2}-\d{2}$/.test(draft.occurred_on) && !Number.isNaN(Date.parse(draft.occurred_on)) && new Date(draft.occurred_on).toISOString().slice(0, 10) === draft.occurred_on ? draft.occurred_on : null,
    account_id: has(catalog.accounts, draft.account_id) ? draft.account_id : null,
    category_id: has(catalog.categories.filter((c) => c.kind === draft.kind), draft.category_id) ? draft.category_id : null,
    card_id: draft.kind === "expense" && draft.payment_method === "credit_card" && has(catalog.cards, draft.card_id) ? draft.card_id : null,
    installments: draft.installments !== null && Number.isInteger(draft.installments) && draft.installments >= 1 && draft.installments <= 24 ? draft.installments : null,
  };
}