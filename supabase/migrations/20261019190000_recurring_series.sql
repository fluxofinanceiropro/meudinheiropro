-- Mark new fixed income and expense occurrences as part of one series.
-- Existing transactions remain ungrouped because guessing which historical
-- rows belong together could modify unrelated financial records.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurring_series_id uuid;
CREATE INDEX IF NOT EXISTS transactions_workspace_recurring_series_date_idx
  ON public.transactions (workspace_id, recurring_series_id, occurred_on)
  WHERE recurring_series_id IS NOT NULL AND deleted_at IS NULL;
