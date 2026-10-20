import type { ComponentProps } from "react";
import { Circle } from "lucide-react";
import { CATEGORY_ICONS, categoryIcon, categoryColor, type CategoryVisual } from "@/lib/categories";
import { cn } from "@/lib/utils";

export interface CategoryIconProps extends ComponentProps<typeof Circle> {
  category?: CategoryVisual | null;
}

export function CategoryIcon({ category, className, ...props }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS.find((entry) => entry.value === categoryIcon(category?.icon))?.Icon ?? Circle;
  return <Icon aria-hidden="true" className={cn("h-5 w-5 shrink-0", className)} color={categoryColor(category?.color)} {...props} />;
}