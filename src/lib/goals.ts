import { toCents } from "./money";

export interface Goal {
  id: string;
  name: string;
  kind: "reserve" | "goal";
  target_amount: number;
  target_date: string | null;
}

export interface GoalEntry {
  id: string;
  goal_id: string;
  amount: number;
  occurred_on: string;
  note: string | null;
}

/** Saved amount per goal, in cents. */
export function savedByGoal(entries: readonly Pick<GoalEntry, "goal_id" | "amount">[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.goal_id, (map.get(e.goal_id) ?? 0) + toCents(e.amount));
  return map;
}

/** Progress 0..1 (capped). Target 0 → 0. */
export function progress(savedCents: number, targetCents: number): number {
  if (targetCents <= 0) return 0;
  return Math.min(1, Math.max(0, savedCents / targetCents));
}

/** Whole months from `today` until `targetDate` (min 1 when date is in the future/current month, 0 when past). */
export function monthsUntil(today: string, targetDate: string): number {
  const [ty = 0, tm = 0] = today.split("-").map(Number);
  const [gy = 0, gm = 0] = targetDate.split("-").map(Number);
  let months = (gy - ty) * 12 + (gm - tm);
  if (targetDate < today) return 0;
  return Math.max(1, months);
}

/** Monthly contribution (cents) to reach target by date; null when no date or already reached. */
export function monthlyNeeded(savedCents: number, targetCents: number, today: string, targetDate: string | null): number | null {
  if (!targetDate) return null;
  const remaining = targetCents - savedCents;
  if (remaining <= 0) return 0;
  const months = monthsUntil(today, targetDate);
  if (months === 0) return remaining;
  return Math.ceil(remaining / months);
}
