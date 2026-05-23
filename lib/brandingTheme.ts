import { brandConfig } from "@/lib/brand";

export type BrandingLabels = {
  vehicle: string;
  driver: string;
  event: string;
  turn: string;
  component: string;
  maintenance: string;
  inventory: string;
};

export type BrandingConfig = {
  showLogoInHeader: boolean;
  showLogoInSidebar: boolean;
  showPlatformName: boolean;
  useTeamNameAsPlatformName: boolean;
  compactHeader: boolean;
  printLetterheadMode: string;
};

export type BrandingTheme = {
  platformName: string;
  platformSubtitle: string | null;
  vendorName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  language: string;
  labels: BrandingLabels;
  brandingConfig: BrandingConfig;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    onAccent: string;
    primarySoft: string;
    secondarySoft: string;
    accentSoft: string;
    surfacePage: string;
    surfaceCard: string;
    surfaceMuted: string;
    textPrimary: string;
    textSecondary: string;
    borderDefault: string;
  };
};

export type RawBrandingSettings = {
  team_name?: string | null;
  team_subtitle?: string | null;
  platform_name?: string | null;
  platform_subtitle?: string | null;
  logo_url?: string | null;
  favicon_url?: string | null;
  language?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  labels?: Partial<BrandingLabels> | null;
  branding_config?: Partial<BrandingConfig> | null;
  branding?: Record<string, unknown> | null;
  theme_tokens?: Record<string, string> | null;
  dashboard_layout?: {
    branding?: {
      platform_name?: string;
      platform_subtitle?: string;
      logo_url?: string;
      favicon_url?: string;
      language?: string;
      branding_config?: Partial<BrandingConfig>;
    };
    [key: string]: unknown;
  } | null;
};

const DEFAULT_LABELS: BrandingLabels = {
  vehicle: "Auto",
  driver: "Pilota",
  event: "Evento",
  turn: "Turno",
  component: "Componente",
  maintenance: "Manutenzione",
  inventory: "Magazzino",
};

const DEFAULT_CONFIG: BrandingConfig = {
  showLogoInHeader: true,
  showLogoInSidebar: true,
  showPlatformName: true,
  useTeamNameAsPlatformName: false,
  compactHeader: false,
  printLetterheadMode: "logo_title_subtitle",
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeAssetPath(value: string | null | undefined, fallback: string | null) {
  if (!value) return fallback;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function isValidHex(value: string | null | undefined) {
  return !!value && /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value);
}

function normalizeHex(value: string | null | undefined, fallback: string) {
  if (!isValidHex(value)) return fallback;
  if (value!.length === 4) {
    return `#${value![1]}${value![1]}${value![2]}${value![2]}${value![3]}${value![3]}`.toLowerCase();
  }
  return value!.toLowerCase();
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex, "#000000").replace("#", "");
  const bigint = parseInt(normalized, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function hexToRgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getContrastText(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

export const DEFAULT_BRANDING_THEME: BrandingTheme = {
  platformName: brandConfig.appName,
  platformSubtitle: brandConfig.appDescription,
  vendorName: brandConfig.vendorName,
  logoUrl: brandConfig.logoPath,
  faviconUrl: brandConfig.faviconPath,
  language: "it",
  labels: DEFAULT_LABELS,
  brandingConfig: DEFAULT_CONFIG,
  colors: {
    primary: "#171717",
    secondary: "#262626",
    accent: normalizeHex(brandConfig.themeColor, "#facc15"),
    onAccent: getContrastText(normalizeHex(brandConfig.themeColor, "#facc15")),
    primarySoft: hexToRgba("#171717", 0.08),
    secondarySoft: hexToRgba("#262626", 0.08),
    accentSoft: hexToRgba(normalizeHex(brandConfig.themeColor, "#facc15"), 0.18),
    surfacePage: "#f5f5f5",
    surfaceCard: "#ffffff",
    surfaceMuted: "#fafafa",
    textPrimary: "#171717",
    textSecondary: "#525252",
    borderDefault: "#e5e5e5",
  },
};

export function buildBrandingTheme(raw?: RawBrandingSettings | null): BrandingTheme {
  const layoutBranding = (raw?.dashboard_layout?.branding || {}) as Record<string, unknown>;
  const branding = (raw?.branding || layoutBranding || {}) as Record<string, unknown>;
  const brandingConfig = {
    ...DEFAULT_CONFIG,
    ...(layoutBranding.branding_config || {}),
    ...(raw?.branding_config || {}),
    ...(branding.branding_config as Partial<BrandingConfig> | undefined),
  };

  const accent = normalizeHex(
    readString(raw?.accent_color || (branding as any).accent_color),
    DEFAULT_BRANDING_THEME.colors.accent
  );
  const primary = normalizeHex(
    readString(raw?.primary_color || (branding as any).primary_color),
    DEFAULT_BRANDING_THEME.colors.primary
  );
  const secondary = normalizeHex(
    readString(raw?.secondary_color || (branding as any).secondary_color),
    DEFAULT_BRANDING_THEME.colors.secondary
  );

  const labels = {
    ...DEFAULT_LABELS,
    ...((raw?.labels || (branding as any).labels || {}) as Partial<BrandingLabels>),
  };

  const platformName =
    readString(raw?.platform_name || (branding as any).platform_name) ||
    (readBoolean(brandingConfig.useTeamNameAsPlatformName, false)
      ? readString(raw?.team_name)
      : "") ||
    DEFAULT_BRANDING_THEME.platformName;

  const platformSubtitle =
    readString(raw?.platform_subtitle || (branding as any).platform_subtitle) ||
    readString(raw?.team_subtitle) ||
    DEFAULT_BRANDING_THEME.platformSubtitle ||
    null;

  return {
    platformName,
    platformSubtitle,
    vendorName: brandConfig.vendorName,
    logoUrl: normalizeAssetPath(
      readString(raw?.logo_url || (branding as any).logo_url) || null,
      DEFAULT_BRANDING_THEME.logoUrl
    ),
    faviconUrl: normalizeAssetPath(
      readString(raw?.favicon_url || (branding as any).favicon_url) || null,
      DEFAULT_BRANDING_THEME.faviconUrl
    ),
    language: readString(raw?.language || (branding as any).language, "it"),
    labels,
    brandingConfig: {
      showLogoInHeader: readBoolean(brandingConfig.showLogoInHeader, true),
      showLogoInSidebar: readBoolean(brandingConfig.showLogoInSidebar, true),
      showPlatformName: readBoolean(brandingConfig.showPlatformName, true),
      useTeamNameAsPlatformName: readBoolean(
        brandingConfig.useTeamNameAsPlatformName,
        false
      ),
      compactHeader: readBoolean(brandingConfig.compactHeader, false),
      printLetterheadMode:
        readString(brandingConfig.printLetterheadMode, "logo_title_subtitle"),
    },
    colors: {
      primary,
      secondary,
      accent,
      onAccent: getContrastText(accent),
      primarySoft: hexToRgba(primary, 0.08),
      secondarySoft: hexToRgba(secondary, 0.08),
      accentSoft: hexToRgba(accent, 0.18),
      surfacePage:
        readString(raw?.theme_tokens?.surface_page, DEFAULT_BRANDING_THEME.colors.surfacePage) ||
        DEFAULT_BRANDING_THEME.colors.surfacePage,
      surfaceCard:
        readString(raw?.theme_tokens?.surface_card, DEFAULT_BRANDING_THEME.colors.surfaceCard) ||
        DEFAULT_BRANDING_THEME.colors.surfaceCard,
      surfaceMuted:
        readString(raw?.theme_tokens?.surface_muted, DEFAULT_BRANDING_THEME.colors.surfaceMuted) ||
        DEFAULT_BRANDING_THEME.colors.surfaceMuted,
      textPrimary:
        readString(raw?.theme_tokens?.text_primary, DEFAULT_BRANDING_THEME.colors.textPrimary) ||
        DEFAULT_BRANDING_THEME.colors.textPrimary,
      textSecondary:
        readString(raw?.theme_tokens?.text_secondary, DEFAULT_BRANDING_THEME.colors.textSecondary) ||
        DEFAULT_BRANDING_THEME.colors.textSecondary,
      borderDefault:
        readString(raw?.theme_tokens?.border_default, DEFAULT_BRANDING_THEME.colors.borderDefault) ||
        DEFAULT_BRANDING_THEME.colors.borderDefault,
    },
  };
}

export function applyBrandingThemeToDocument(theme: BrandingTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.setProperty("--brand-primary", theme.colors.primary);
  root.style.setProperty("--brand-secondary", theme.colors.secondary);
  root.style.setProperty("--brand-accent", theme.colors.accent);
  root.style.setProperty("--brand-on-accent", theme.colors.onAccent);
  root.style.setProperty("--brand-primary-soft", theme.colors.primarySoft);
  root.style.setProperty("--brand-secondary-soft", theme.colors.secondarySoft);
  root.style.setProperty("--brand-accent-soft", theme.colors.accentSoft);
  root.style.setProperty("--surface-page", theme.colors.surfacePage);
  root.style.setProperty("--surface-card", theme.colors.surfaceCard);
  root.style.setProperty("--surface-muted", theme.colors.surfaceMuted);
  root.style.setProperty("--text-primary", theme.colors.textPrimary);
  root.style.setProperty("--text-secondary", theme.colors.textSecondary);
  root.style.setProperty("--border-default", theme.colors.borderDefault);
  root.lang = theme.language || "it";

  if (theme.faviconUrl) {
    const link =
      (document.querySelector("link[rel='icon']") as HTMLLinkElement | null) ||
      document.createElement("link");

    link.rel = "icon";
    link.href = theme.faviconUrl;
    if (!link.parentNode) document.head.appendChild(link);
  }

  let metaTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = theme.colors.primary;

  if (document.title) {
    document.title = document.title
      .replace(brandConfig.appName, theme.platformName)
      .replace("Parco Auto", theme.platformName)
      .replace("Motorsport Management", theme.platformName);
  } else {
    document.title = theme.platformName;
  }
}

export function dispatchBrandingRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("branding:refresh"));
  }
}
