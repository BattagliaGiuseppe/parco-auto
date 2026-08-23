"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamSettings } from "@/lib/teamContext";
import { resolveTeamFileUrl } from "@/lib/storage";
import {
  applyBrandingThemeToDocument,
  buildBrandingTheme,
  DEFAULT_BRANDING_THEME,
  type BrandingTheme,
  type RawBrandingSettings,
} from "@/lib/brandingTheme";

type BrandThemeContextValue = {
  theme: BrandingTheme;
  refreshTheme: () => Promise<void>;
};

const BrandThemeContext = createContext<BrandThemeContextValue>({
  theme: DEFAULT_BRANDING_THEME,
  refreshTheme: async () => {},
});

export function useBrandTheme() {
  return useContext(BrandThemeContext);
}

export default function BrandThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<BrandingTheme>(DEFAULT_BRANDING_THEME);

  async function refreshTheme() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setTheme(DEFAULT_BRANDING_THEME);
        return;
      }

      const settings = (await getCurrentTeamSettings()) as RawBrandingSettings | null;
      const nextTheme = buildBrandingTheme(settings);
      const [sidebarLogoUrl, headerLogoUrl, printLogoUrl] = await Promise.all([
        resolveTeamFileUrl(nextTheme.sidebarLogoUrl).catch(() => nextTheme.sidebarLogoUrl),
        resolveTeamFileUrl(nextTheme.headerLogoUrl).catch(() => nextTheme.headerLogoUrl),
        resolveTeamFileUrl(nextTheme.printLogoUrl).catch(() => nextTheme.printLogoUrl),
      ]);

      setTheme({
        ...nextTheme,
        sidebarLogoUrl,
        headerLogoUrl,
        printLogoUrl,
      });
    } catch {
      setTheme(DEFAULT_BRANDING_THEME);
    }
  }

  useEffect(() => {
    let active = true;

    const safeRefresh = async () => {
      await refreshTheme();
    };

    void safeRefresh();

    const handler = () => {
      void safeRefresh();
    };

    window.addEventListener("branding:refresh", handler);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!active) return;
      void safeRefresh();
    });

    return () => {
      active = false;
      window.removeEventListener("branding:refresh", handler);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyBrandingThemeToDocument(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      refreshTheme,
    }),
    [theme]
  );

  return (
    <BrandThemeContext.Provider value={value}>
      {children}
    </BrandThemeContext.Provider>
  );
}
