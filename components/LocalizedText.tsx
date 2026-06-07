"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

export default function LocalizedText({ text }: { text: string }) {
  const { t } = useLanguage();
  return <>{t(`ui.${text}`, text)}</>;
}
