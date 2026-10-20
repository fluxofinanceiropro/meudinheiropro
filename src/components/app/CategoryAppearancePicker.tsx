import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryIcon } from "./CategoryIcon";
import { CATEGORY_ICONS, CATEGORY_COLORS, categoryColor, categoryIcon, type CategoryVisual } from "@/lib/categories";
import { cn } from "@/lib/utils";

export interface CategoryAppearancePickerProps {
  name: string;
  icon: string;
  color: string;
  onChange: (visual: Required<CategoryVisual>) => void;
  disabled?: boolean;
}

export function CategoryAppearancePicker({ name, icon, color, onChange, disabled }: CategoryAppearancePickerProps) {
  const normalizedColor = categoryColor(color);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3" aria-label="Prévia da categoria">
        <CategoryIcon category={{ icon, color }} className="h-6 w-6" />
        <span className="min-w-0 break-words font-medium">{name.trim() || "Categoria"}</span>
      </div>
      <fieldset disabled={disabled} className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Ícone</legend>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {CATEGORY_ICONS.map(({ value, label, Icon }) => (
            <Button key={value} type="button" variant="outline" size="icon" title={label} aria-label={`Ícone: ${label}`} aria-pressed={categoryIcon(icon) === value}
              className={cn("w-full rounded-lg", categoryIcon(icon) === value && "border-primary bg-accent")}
              onClick={() => onChange({ icon: value, color })}>
              <Icon color={normalizedColor} />
            </Button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled} className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Cor</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map(({ value, label }) => (
            <Button key={value} type="button" variant="outline" size="icon" title={label} aria-label={`Cor: ${label}`} aria-pressed={normalizedColor === value}
              className={cn("rounded-lg", normalizedColor === value && "border-primary ring-1 ring-ring")}
              onClick={() => onChange({ icon, color: value })}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill={value} /></svg>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="cat-color">Personalizada</Label>
          <Input id="cat-color" type="color" value={normalizedColor} className="h-9 w-12 cursor-pointer p-1" onChange={(e) => onChange({ icon, color: e.target.value })} />
          <Input aria-label="Código da cor" value={color} maxLength={7} placeholder="#738094" className="h-9 w-28 font-mono" onChange={(e) => onChange({ icon, color: e.target.value })} />
          <Check aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        </div>
      </fieldset>
    </div>
  );
}