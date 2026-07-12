export type CurrencyOption = {
  /** Stored in spaces.currency. Real currencies use their ISO 4217 code (so
   * Intl.NumberFormat can format them natively); IRT is a pseudo-code -- the
   * Toman isn't itself an ISO currency (Iran's official one is the Rial) but
   * it's what's actually used day to day, so it gets a hand-rolled formatter. */
  code: string;
  symbol: string;
  label: string;
};

export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "CNY", symbol: "¥", label: "Chinese Yuan" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "CHF", symbol: "Fr", label: "Swiss Franc" },
  { code: "IRT", symbol: "تومان", label: "Iranian Toman" },
];
