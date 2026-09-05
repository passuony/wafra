// @refresh reset
import React, { createContext, useContext, useState, useEffect } from "react";
import { Lang, translations } from "@/lib/translations";

export type Translations = typeof translations.ar;

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
  dir: "rtl" | "ltr";
  locale: string;
}

const defaultCtx: LanguageContextType = {
  lang: "en",
  setLang: () => {},
  t: translations.en as unknown as Translations,
  dir: "ltr",
  locale: "en-US",
};

const LanguageContext = createContext<LanguageContextType>(defaultCtx);

const STORAGE_KEY = "wafra_lang";

function getSavedLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ar" || saved === "en" || saved === "ru") return saved;
  } catch {}
  return "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getSavedLang);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    try { localStorage.setItem(STORAGE_KEY, newLang); } catch {}
  };

  useEffect(() => {
    const tr = translations[lang];
    document.documentElement.setAttribute("dir", tr.dir);
    document.documentElement.setAttribute("lang", tr.lang);
  }, [lang]);

  const tr = translations[lang] as unknown as Translations;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: tr, dir: translations[lang].dir, locale: translations[lang].locale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
