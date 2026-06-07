"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function ThemeToggle() {
  const { t } = useLanguage();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("theme") === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);

  const toggleTheme = () => {
    if (dark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
    setDark(!dark);
  };

  return (
    <button
      onClick={toggleTheme}
      className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700"
      aria-label={dark ? t("theme.dark", "Tema scuro") : t("theme.light", "Tema chiaro")}
      title={dark ? t("theme.dark", "Tema scuro") : t("theme.light", "Tema chiaro")}
    >
      {dark ? `🌙 ${t("theme.darkShort", "Scuro")}` : `☀️ ${t("theme.lightShort", "Chiaro")}`}
    </button>
  );
}
