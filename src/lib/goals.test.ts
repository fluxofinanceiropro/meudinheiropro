import { describe, it, expect } from "vitest";
import { savedByGoal, progress, monthsUntil, monthlyNeeded } from "./goals";

describe("goals", () => {
  it("soma aportes e retiradas por meta em centavos", () => {
    const m = savedByGoal([
      { goal_id: "a", amount: 100.1 },
      { goal_id: "a", amount: 0.2 },
      { goal_id: "a", amount: -50 },
      { goal_id: "b", amount: 10 },
    ]);
    expect(m.get("a")).toBe(5030);
    expect(m.get("b")).toBe(1000);
  });
  it("progresso limitado a 100%", () => {
    expect(progress(15000, 10000)).toBe(1);
    expect(progress(2500, 10000)).toBe(0.25);
    expect(progress(100, 0)).toBe(0);
  });
  it("meses até a data", () => {
    expect(monthsUntil("2026-10-12", "2027-10-12")).toBe(12);
    expect(monthsUntil("2026-10-12", "2026-10-30")).toBe(1);
    expect(monthsUntil("2026-10-12", "2026-09-01")).toBe(0);
  });
  it("valor mensal necessário", () => {
    expect(monthlyNeeded(0, 120000, "2026-10-12", "2027-10-12")).toBe(10000);
    expect(monthlyNeeded(130000, 120000, "2026-10-12", "2027-10-12")).toBe(0);
    expect(monthlyNeeded(0, 1000, "2026-10-12", null)).toBeNull();
    expect(monthlyNeeded(0, 1000, "2026-10-12", "2026-01-01")).toBe(1000);
  });
});
