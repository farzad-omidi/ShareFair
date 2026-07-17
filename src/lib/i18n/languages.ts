export type LanguageCode = "en" | "es" | "fr" | "de" | "pt" | "ru" | "zh" | "hi" | "ar" | "fa" | "nl";

export type LanguageOption = {
  code: LanguageCode;
  label: string;
  rtl?: boolean;
};

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "ar", label: "العربية", rtl: true },
  { code: "fa", label: "فارسی", rtl: true },
  { code: "nl", label: "Nederlands" },
];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export function isRtl(code: LanguageCode): boolean {
  return LANGUAGES.find((l) => l.code === code)?.rtl ?? false;
}
