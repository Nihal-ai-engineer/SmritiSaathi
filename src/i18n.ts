import { useSyncExternalStore } from "react";
import en from "./locales/en.json" with { type: "json" };
import hi from "./locales/hi.json" with { type: "json" };
import as from "./locales/as.json" with { type: "json" };
import bn from "./locales/bn.json" with { type: "json" };

export type AppLanguage = "en" | "hi" | "as" | "bn";
export const languageOptions = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "as", name: "অসমীয়া" },
  { code: "bn", name: "বাংলা" },
] as const;
const packs: Record<AppLanguage, Record<string, string>> = { en, hi, as, bn };
const storageKey = "smriti-ui-language";
export function isAppLanguage(value: unknown): value is AppLanguage {
  return languageOptions.some((option) => option.code === value);
}
function readPreference(): AppLanguage {
  try {
    const value = localStorage.getItem(storageKey);
    return isAppLanguage(value) ? value : "en";
  } catch {
    return "en";
  }
}
let language: AppLanguage = readPreference();
const listeners = new Set<() => void>();
export function setLanguage(value: AppLanguage): boolean {
  if (!isAppLanguage(value)) return false;
  language = value;
  let saved = true;
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    saved = false;
  }
  listeners.forEach((listener) => listener());
  return saved;
}
export function useLanguage(): AppLanguage {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => language,
    () => "en",
  );
}
// Call only for developer-authored interface text, never names or care records.
export function translate(english: string, hindiFallback?: string): string {
  return (
    packs[language][english]?.trim() ||
    (language === "hi" ? hindiFallback : undefined) ||
    english
  );
}
export function translationCoverage(code: AppLanguage) {
  const keys = Object.keys(en);
  return {
    translated: keys.filter((key) => packs[code][key]?.trim()).length,
    total: keys.length,
  };
}
export const regionLanguageCodes: Record<string, string> = {
  "Arunachal Pradesh": "njz",
  Assam: "as",
  Manipur: "mni",
  Meghalaya: "kha",
  Mizoram: "lus",
  Nagaland: "nag",
  Tripura: "bn",
  Sikkim: "ne",
};
