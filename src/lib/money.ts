/** Money is handled as integer cents in the client to avoid float drift. */
export type Cents = number;

export function toCents(value: number | string | null | undefined): Cents {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Parses Brazilian-format user input ("1.234,56", "180", "R$ 9,90") into cents. Returns null if invalid. */
export function parseBRL(input: string): Cents | null {
  const cleaned = input.replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [int, dec = ""] = normalized.replace("-", "").split(".");
  const cents = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  return normalized.startsWith("-") ? -cents : cents;
}

/** Cents → decimal string for the database ("180.00"). */
export function centsToDecimal(c: Cents): string {
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(c: Cents): string {
  return fmt.format(c / 100);
}
