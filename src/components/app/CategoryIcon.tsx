import { CircleHelp, Home, ShoppingCart, Utensils, Car, HeartPulse, GraduationCap, Gift, Gamepad2, Coffee, BriefcaseBusiness, Wallet, PiggyBank, CreditCard, Smartphone, Plane, Shirt, Wrench, Zap, Baby, PawPrint, Music, TrendingUp, Landmark, Receipt, type LucideIcon } from "lucide-react";
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  circle: CircleHelp, home: Home, cart: ShoppingCart, food: Utensils, car: Car, health: HeartPulse,
  school: GraduationCap, gift: Gift, games: Gamepad2, coffee: Coffee, work: BriefcaseBusiness,
  wallet: Wallet, savings: PiggyBank, card: CreditCard, phone: Smartphone, travel: Plane,
  clothes: Shirt, repairs: Wrench, power: Zap, child: Baby, pets: PawPrint, music: Music,
  growth: TrendingUp, bank: Landmark, receipt: Receipt,
};
export const CATEGORY_COLORS = ["#dc645b", "#d68b3f", "#d3b34b", "#63a46c", "#33958e", "#4387bd", "#7769ba", "#b36b9e", "#738094", "#9b795f"];
export function CategoryIcon({ icon, color, className = "h-4 w-4" }: { icon?: string | null; color?: string | null; className?: string }) {
  const Icon = CATEGORY_ICONS[icon || ""] || CircleHelp;
  return <Icon className={className} style={{ color: /^#[0-9a-fA-F]{6}$/.test(color || "") ? color! : undefined }} aria-hidden="true" />;
}
