"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useBrandTheme } from "@/components/providers/BrandThemeProvider";
import {
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  translateKey,
  type LanguageCode,
} from "@/lib/i18n";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: string) => void;
  t: (key: string, fallback?: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "it",
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
});

function readStoredLanguage() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
}

function writeStoredLanguage(language: LanguageCode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const { theme } = useBrandTheme();
  const [language, setLanguageState] = useState<LanguageCode>(() => normalizeLanguage("it"));

  useEffect(() => {
    const storedLanguage = readStoredLanguage();

    // The team/control-center language is the canonical app language once it is available.
    // localStorage is only used as a fallback for first paint/offline cases and is then
    // realigned, so the sidebar selector and the Control Center selector cannot drift apart.
    const nextLanguage = normalizeLanguage(theme.language || storedLanguage || "it");
    writeStoredLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  }, [theme.language]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: string) => {
    const normalized = normalizeLanguage(nextLanguage);
    writeStoredLanguage(normalized);
    setLanguageState(normalized);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, fallback) => translateKey(key, language, fallback),
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
