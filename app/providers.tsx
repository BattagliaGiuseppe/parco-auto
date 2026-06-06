"use client";

import BrandThemeProvider from "@/components/providers/BrandThemeProvider";
import LanguageProvider from "@/components/providers/LanguageProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BrandThemeProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </BrandThemeProvider>
  );
}
