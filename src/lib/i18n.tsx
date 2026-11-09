import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { dictionaries, type DictKey, type Lang } from "./i18n-dictionary";

const STORAGE_KEY = "afa-lang";
export const DEFAULT_LANG: Lang = "fa";

type I18nValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
  formatNumber: (n: number) => string;
  formatDate: (iso: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function dirFor(lang: Lang): "rtl" | "ltr" {
  return lang === "fa" ? "rtl" : "ltr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Read the saved preference after hydration so server and client markup match.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "fa") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirFor(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaries[lang];
    const locale = lang === "fa" ? "fa-AF" : "en-GB";
    const numberFmt = new Intl.NumberFormat(locale);
    const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    return {
      lang,
      dir: dirFor(lang),
      setLang,
      t: (key, vars) => {
        let text = dict[key];
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, typeof v === "number" ? numberFmt.format(v) : v);
          }
        }
        return text;
      },
      formatNumber: (n) => numberFmt.format(n),
      formatDate: (iso) => dateFmt.format(new Date(iso)),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}
