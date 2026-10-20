import { describe, it, expect } from "vitest";
import { categoryColor, categoryIcon, categoryPayload, isCategoryColor } from "./categories";

describe("category appearance data", () => {
  it("preserves predefined and custom six-digit colors", () => {
    expect(categoryColor("#2878c7")).toBe("#2878c7");
    expect(categoryColor("#12ABCD")).toBe("#12abcd");
    expect(isCategoryColor("#12abcz")).toBe(false);
    expect(isCategoryColor("red")).toBe(false);
    expect(isCategoryColor("#123")).toBe(false);
  });
  it("keeps legacy categories usable with the database default fallback", () => {
    expect(categoryPayload(" Alimentação ", { icon: null, color: null })).toEqual({ name: "Alimentação", icon: "circle", color: "#738094" });
    expect(categoryColor("url(unsafe)")).toBe("#738094");
    expect(categoryIcon("unknown")).toBe("circle");
  });
  it("normalizes supported Lucide names without depending on the draft PR", () => {
    expect(categoryIcon("ShoppingCart")).toBe("shopping-cart");
    expect(categoryIcon("shopping-cart")).toBe("shopping-cart");
    expect(categoryPayload("Salário", { icon: "Banknote", color: "#123ABC" })).toEqual({ name: "Salário", icon: "banknote", color: "#123abc" });
  });
});