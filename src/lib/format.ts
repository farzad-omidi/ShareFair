const fmtCache: Record<string, Intl.NumberFormat> = {};

export function money(v: number, currency = "EUR"): string {
  if (!fmtCache[currency]) {
    fmtCache[currency] = new Intl.NumberFormat(undefined, { style: "currency", currency });
  }
  return fmtCache[currency].format(Math.abs(v) < 0.005 ? 0 : v);
}

export function symbol(currency: string): string {
  return { EUR: "€", USD: "$", GBP: "£", CAD: "$", AUD: "$", TRY: "₺" }[currency] || currency;
}

export function parseAmount(v: string): number {
  return Number(String(v ?? "").replace(/[€$£₺]/g, "").replace(/\s/g, "").replace(",", "."));
}
