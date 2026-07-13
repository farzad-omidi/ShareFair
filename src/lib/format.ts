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

// Parses a human-typed amount string into a number, tolerating both US-style
// (1,234.56) and European-style (1.234,56) thousands/decimal separators.
//
// Rules, applied after stripping currency symbols and whitespace:
//  - A number has at most one decimal point, so if a separator character
//    shows up MORE THAN ONCE it cannot be the decimal separator -- every
//    instance of it is a thousands separator and gets stripped.
//  - If both "," and "." appear, whichever appears LAST is the decimal
//    separator; every earlier instance of either character (including
//    repeats of the decimal separator itself, from malformed input) is
//    treated as a thousands separator and stripped.
//  - If only "," appears exactly once, it's ambiguous between a thousands
//    separator ("1,234") and a decimal comma ("12,5"). A trailing group of
//    exactly 3 digits ("1,234") is read as thousands -- that shape is
//    essentially never a genuine decimal-comma amount (those are 1-2 digits,
//    e.g. "12,50"). Anything else is read as the decimal separator.
//  - If only "." appears exactly once with a trailing group of exactly 3
//    digits ("1.500", "45.000"), the input is GENUINELY ambiguous and gets
//    rejected (NaN) rather than guessed, because the two readings are both
//    common and 1000x apart: it could be a whole-number thousands amount
//    with no cents (e.g. European-style rent "1.500" meaning 1500) or a
//    decimal typo (e.g. "45.000" meaning "45.00"). Guessing either way risks
//    silently recording an amount off by 1000x with nothing to alert the
//    user -- worse than rejecting input that has no reliable reading. (A
//    leading "0" group, e.g. "0.123", is exempt: nobody writes "0,123" for
//    123, so it's unambiguously a fraction.) Any other single-dot shape
//    (1 or 2 trailing digits, or 4+) is unambiguous and read as decimal.
//
// Sanity checks (verified via `node -e`):
//   parseAmount("1,234.56")     === 1234.56
//   parseAmount("1.234,56")     === 1234.56
//   parseAmount("1234.56")      === 1234.56
//   parseAmount("1,234")        === 1234     (lone comma, 3-digit tail -> thousands)
//   parseAmount("1.234")        Number.isNaN  (lone dot, 3-digit tail -> genuinely ambiguous)
//   parseAmount("12.5")         === 12.5
//   parseAmount("12,5")         === 12.5
//   parseAmount("12,50")        === 12.5
//   parseAmount("45.000")       Number.isNaN  (not 45000 -- avoids silent 1000x inflation)
//   parseAmount("1.500")        Number.isNaN  (not 1.5 -- avoids silent 1000x deflation of rent-style input)
//   parseAmount("0.123")        === 0.123     (leading zero group -> unambiguously decimal)
//   parseAmount("1,234,567.89") === 1234567.89
//   parseAmount("1.234.567,89") === 1234567.89
//   parseAmount("1,234,567")    === 1234567  (repeated comma -> always thousands)
//   parseAmount("1.234,567,89") === 1234567.89 (malformed extra commas stripped, not NaN)
//   parseAmount("1,234.567.89") === 1234567.89 (malformed extra dots stripped, not NaN)
export function parseAmount(v: string): number {
  let s = String(v ?? "")
    .replace(/[€$£¥₹]|تومان|Fr/g, "")
    .replace(/\s/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const decimalSep = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thousandsSep = decimalSep === "," ? "." : ",";
    s = s.split(thousandsSep).join("");
    const decimalParts = s.split(decimalSep);
    s = decimalParts.length > 1
      ? decimalParts.slice(0, -1).join("") + "." + decimalParts[decimalParts.length - 1]
      : decimalParts[0];
  } else if (hasComma) {
    const parts = s.split(",");
    const looksLikeThousands = parts.length === 2 && /^\d{3}$/.test(parts[1]);
    s = parts.length > 2 || looksLikeThousands ? parts.join("") : s.replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length > 2) {
      s = parts.join("");
    } else if (parts[0] !== "0" && parts[0] !== "-0" && /^\d{3}$/.test(parts[1])) {
      return NaN;
    }
  }

  return Number(s);
}

export function initials(name: string, maxLetters = 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, maxLetters)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}
