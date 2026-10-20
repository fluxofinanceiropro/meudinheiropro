import { Circle, Utensils, ShoppingCart, Home, Car, Bus, Heart, Pill, GraduationCap, Briefcase, Wallet, Banknote, Gift, Plane, Shirt, PawPrint, Dumbbell, Music, Smartphone, Wrench, type LucideIcon } from "lucide-react";

export const CATEGORY_ICONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "circle", label: "Círculo", Icon: Circle },
  { value: "utensils", label: "Alimentação", Icon: Utensils },
  { value: "shopping-cart", label: "Compras", Icon: ShoppingCart },
  { value: "home", label: "Casa", Icon: Home },
  { value: "car", label: "Carro", Icon: Car },
  { value: "bus", label: "Transporte", Icon: Bus },
  { value: "heart", label: "Saúde", Icon: Heart },
  { value: "pill", label: "Medicamentos", Icon: Pill },
  { value: "graduation-cap", label: "Educação", Icon: GraduationCap },
  { value: "briefcase", label: "Trabalho", Icon: Briefcase },
  { value: "wallet", label: "Carteira", Icon: Wallet },
  { value: "banknote", label: "Dinheiro", Icon: Banknote },
  { value: "gift", label: "Presentes", Icon: Gift },
  { value: "plane", label: "Viagem", Icon: Plane },
  { value: "shirt", label: "Roupas", Icon: Shirt },
  { value: "paw-print", label: "Animais", Icon: PawPrint },
  { value: "dumbbell", label: "Esporte", Icon: Dumbbell },
  { value: "music", label: "Lazer", Icon: Music },
  { value: "smartphone", label: "Tecnologia", Icon: Smartphone },
  { value: "wrench", label: "Serviços", Icon: Wrench },
];

// Persisted category data, not application theme colors.
export const DEFAULT_CATEGORY_COLOR = "#738094";
export const CATEGORY_COLORS = [
  { value: DEFAULT_CATEGORY_COLOR, label: "Cinza" },
  { value: "#16856b", label: "Verde" },
  { value: "#2878c7", label: "Azul" },
  { value: "#bf4545", label: "Vermelho" },
  { value: "#ba741b", label: "Âmbar" },
  { value: "#9b54bc", label: "Violeta" },
  { value: "#c34f87", label: "Rosa" },
  { value: "#168697", label: "Turquesa" },
];

export interface CategoryVisual { icon?: string | null; color?: string | null }

export function isCategoryColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function categoryColor(value?: string | null): string {
  return value && isCategoryColor(value) ? value.toLowerCase() : DEFAULT_CATEGORY_COLOR;
}

export function categoryIcon(value?: string | null): string {
  // Accept preliminary PR conventions (PascalCase or camelCase) as well as kebab-case.
  const key = value?.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  return CATEGORY_ICONS.find((entry) => entry.value === key)?.value ?? "circle";
}

export function categoryPayload(name: string, visual: CategoryVisual) {
  return { name: name.trim(), icon: categoryIcon(visual.icon), color: categoryColor(visual.color) };
}