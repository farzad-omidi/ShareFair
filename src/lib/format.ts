import { CURRENCIES } from "@/lib/currencies";

const fmtCache: Record<string, Intl.NumberFormat> = {};

export function money(v: number, currency = "EUR"): string {
  const amount = Math.abs(v) < 0.005 ? 0 : v;
  // Toman isn't an ISO 4217 code Intl.NumberFormat understands, and isn't
  // conventionally shown with decimal subunits -- format it by hand.
  if (currency === "IRT") {
    if (!fmtCache.IRT) fmtCache.IRT = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
    return `${fmtCache.IRT.format(amount)} ${symbol("IRT")}`;
  }
  if (!fmtCache[currency]) {
    try {
      fmtCache[currency] = new Intl.NumberFormat(undefined, { style: "currency", currency });
    } catch {
      fmtCache[currency] = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    }
  }
  return fmtCache[currency].format(amount);
}

export function symbol(currency: string): string {
  return CURRENCIES.find((c) => c.code === currency)?.symbol || currency;
}

export function parseAmount(v: string): number {
  return Number(
    String(v ?? "")
      .replace(/[€$£¥₹]|تومان|Fr/g, "")
      .replace(/\s/g, "")
      .replace(",", ".")
  );
}

export function initials(name: string, maxLetters = 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, maxLetters)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}
