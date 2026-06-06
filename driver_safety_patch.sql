"use client";

import BrandThemeProvider from "@/components/providers/BrandThemeProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <BrandThemeProvider>{children}</BrandThemeProvider>;
}
