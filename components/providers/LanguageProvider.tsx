"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBrandTheme } from "@/components/providers/BrandThemeProvider";
import {
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  translateDocumentText,
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
  const initializedRef = useRef(false);

  useEffect(() => {
    const storedLanguage = readStoredLanguage();
    const nextLanguage = normalizeLanguage(storedLanguage || theme.language || "it");
    setLanguageState(nextLanguage);
    initializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!initializedRef.current) return;

    const storedLanguage = readStoredLanguage();
    if (storedLanguage) return;

    const themeLanguage = normalizeLanguage(theme.language || "it");
    setLanguageState(themeLanguage);
  }, [theme.language]);

  const setLanguage = useCallback((nextLanguage: string) => {
    const normalized = normalizeLanguage(nextLanguage);
    writeStoredLanguage(normalized);
    setLanguageState(normalized);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("language:change", { detail: { language: normalized } })
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let timer: number | null = null;

    const runTranslation = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        translateDocumentText(language);
      }, 20);
    };

    translateDocumentText(language);

    const observer = new MutationObserver(() => {
      runTranslation();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });

    window.addEventListener("language:refresh", runTranslation);

    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("language:refresh", runTranslation);
    };
  }, [language]);

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
