import { brandConfig } from "@/lib/brand";
import { DEFAULT_CONTROL_CENTER_LABELS, type ControlCenterLabels } from "@/lib/controlCenter";

export type BrandingLabels = ControlCenterLabels;

export type BrandingConfig = {
  showLogoInHeader: boolean;
  showLogoInSidebar: boolean;
  showLogoInPrint: boolean;
  showPlatformNameInHeader: boolean;
  showPlatformNameInSidebar: boolean;
  compactHeader: boolean;
  printLetterheadMode: string;
};

export type BrandingTheme = {
  platformName: string;
  platformSubtitle: string | null;
  vendorName: string;
  faviconUrl: string | null;
  language: string;
  teamName: string;
  teamSubtitle: string | null;
  sidebarLogoUrl: string | null;
  headerLogoUrl: string | null;
  printLogoUrl: string | null;
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
  language?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  labels?: Partial<BrandingLabels> | null;
  branding?: Record<string, unknown> | null;
  theme_tokens?: Record<string, string> | null;
  dashboard_layout?: {
    branding?: {
      sidebar_logo_url?: string;
      header_logo_url?: string;
      print_logo_url?: string;
      language?: string;
      branding_config?: Partial<BrandingConfig>;
    };
    [key: string]: unknown;
  } | null;
};

const DEFAULT_LABELS: BrandingLabels = DEFAULT_CONTROL_CENTER_LABELS;

const DEFAULT_CONFIG: BrandingConfig = {
  showLogoInHeader: true,
  showLogoInSidebar: true,
  showLogoInPrint: true,
  showPlatformNameInHeader: true,
  showPlatformNameInSidebar: true,
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

function getHexLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function resolveDarkSurfaceToken(value: string | null | undefined, fallback: string) {
  if (!isValidHex(value)) return fallback;
  const normalized = normalizeHex(value, fallback);
  return getHexLuminance(normalized) <= 0.36 ? normalized : fallback;
}

function resolveReadableTextToken(value: string | null | undefined, fallback: string) {
  if (!isValidHex(value)) return fallback;
  const normalized = normalizeHex(value, fallback);
  return getHexLuminance(normalized) >= 0.58 ? normalized : fallback;
}

function resolveSubtleBorderToken(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed.startsWith("rgba(") || trimmed.startsWith("rgb(")) return trimmed;
  if (!isValidHex(trimmed)) return fallback;
  const normalized = normalizeHex(trimmed, fallback);
  const luminance = getHexLuminance(normalized);
  return luminance > 0.18 && luminance < 0.75 ? normalized : fallback;
}

export const DEFAULT_BRANDING_THEME: BrandingTheme = {
  platformName: brandConfig.appName,
  platformSubtitle: brandConfig.appDescription,
  vendorName: brandConfig.vendorName,
  faviconUrl: brandConfig.faviconPath,
  language: "it",
  teamName: brandConfig.defaultTeamName,
  teamSubtitle: brandConfig.defaultTeamSubtitle,
  sidebarLogoUrl: brandConfig.logoPath,
  headerLogoUrl: brandConfig.logoPath,
  printLogoUrl: brandConfig.logoPath,
  labels: DEFAULT_LABELS,
  brandingConfig: DEFAULT_CONFIG,
  colors: {
    primary: "#070a0d",
    secondary: "#111821",
    accent: normalizeHex(brandConfig.themeColor, "#f8c400"),
    onAccent: getContrastText(normalizeHex(brandConfig.themeColor, "#f8c400")),
    primarySoft: hexToRgba("#f8c400", 0.1),
    secondarySoft: hexToRgba("#94a3b8", 0.12),
    accentSoft: hexToRgba(normalizeHex(brandConfig.themeColor, "#f8c400"), 0.18),
    surfacePage: "#080c10",
    surfaceCard: "#10161d",
    surfaceMuted: "#151c24",
    textPrimary: "#f6f7f3",
    textSecondary: "#d8dee9",
    borderDefault: "rgba(255,255,255,0.12)",
  },
};

export function buildBrandingTheme(raw?: RawBrandingSettings | null): BrandingTheme {
  const layoutBranding = (raw?.dashboard_layout?.branding || {}) as Record<string, unknown>;
  const branding = (raw?.branding || layoutBranding || {}) as Record<string, unknown>;
  const brandingConfig = {
    ...DEFAULT_CONFIG,
    ...(layoutBranding.branding_config || {}),
    ...(branding.branding_config as Partial<BrandingConfig> | undefined),
  };

  const accent = normalizeHex(readString(raw?.accent_color), DEFAULT_BRANDING_THEME.colors.accent);
  const primary = normalizeHex(readString(raw?.primary_color), DEFAULT_BRANDING_THEME.colors.primary);
  const secondary = normalizeHex(readString(raw?.secondary_color), DEFAULT_BRANDING_THEME.colors.secondary);

  const labels = {
    ...DEFAULT_LABELS,
    ...((raw?.labels || {}) as Partial<BrandingLabels>),
  };

  const sidebarLogoUrl = normalizeAssetPath(
    readString((branding as any).sidebar_logo_url) || readString((branding as any).header_logo_url),
    DEFAULT_BRANDING_THEME.sidebarLogoUrl
  );

  const headerLogoUrl = normalizeAssetPath(
    readString((branding as any).header_logo_url) || readString((branding as any).sidebar_logo_url),
    DEFAULT_BRANDING_THEME.headerLogoUrl
  );

  const printLogoUrl = normalizeAssetPath(
    readString((branding as any).print_logo_url) ||
      readString((branding as any).header_logo_url) ||
      readString((branding as any).sidebar_logo_url),
    DEFAULT_BRANDING_THEME.printLogoUrl
  );

  return {
    platformName: brandConfig.appName,
    platformSubtitle: brandConfig.appDescription,
    vendorName: brandConfig.vendorName,
    faviconUrl: brandConfig.faviconPath,
    language: readString((branding as any).language || raw?.language, "it"),
    teamName: readString(raw?.team_name, brandConfig.defaultTeamName),
    teamSubtitle: readString(raw?.team_subtitle, brandConfig.defaultTeamSubtitle),
    sidebarLogoUrl,
    headerLogoUrl,
    printLogoUrl,
    labels,
    brandingConfig: {
      showLogoInHeader: readBoolean(brandingConfig.showLogoInHeader, true),
      showLogoInSidebar: readBoolean(brandingConfig.showLogoInSidebar, true),
      showLogoInPrint: readBoolean(brandingConfig.showLogoInPrint, true),
      showPlatformNameInHeader: readBoolean(brandingConfig.showPlatformNameInHeader, true),
      showPlatformNameInSidebar: readBoolean(brandingConfig.showPlatformNameInSidebar, true),
      compactHeader: readBoolean(brandingConfig.compactHeader, false),
      printLetterheadMode: readString(brandingConfig.printLetterheadMode, "logo_title_subtitle"),
    },
    colors: {
      primary,
      secondary,
      accent,
      onAccent: getContrastText(accent),
      primarySoft: hexToRgba(primary, 0.08),
      secondarySoft: hexToRgba(secondary, 0.08),
      accentSoft: hexToRgba(accent, 0.18),
      surfacePage: resolveDarkSurfaceToken(
        readString(raw?.theme_tokens?.surface_page),
        DEFAULT_BRANDING_THEME.colors.surfacePage
      ),
      surfaceCard: resolveDarkSurfaceToken(
        readString(raw?.theme_tokens?.surface_card),
        DEFAULT_BRANDING_THEME.colors.surfaceCard
      ),
      surfaceMuted: resolveDarkSurfaceToken(
        readString(raw?.theme_tokens?.surface_muted),
        DEFAULT_BRANDING_THEME.colors.surfaceMuted
      ),
      textPrimary: resolveReadableTextToken(
        readString(raw?.theme_tokens?.text_primary),
        DEFAULT_BRANDING_THEME.colors.textPrimary
      ),
      textSecondary: resolveReadableTextToken(
        readString(raw?.theme_tokens?.text_secondary),
        DEFAULT_BRANDING_THEME.colors.textSecondary
      ),
      borderDefault: resolveSubtleBorderToken(
        readString(raw?.theme_tokens?.border_default),
        DEFAULT_BRANDING_THEME.colors.borderDefault
      ),
    },
  };
}

export function applyBrandingThemeToDocument(theme: BrandingTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const primaryRgb = hexToRgb(theme.colors.primary);
  const secondaryRgb = hexToRgb(theme.colors.secondary);
  const accentRgb = hexToRgb(theme.colors.accent);

  root.style.setProperty("--brand-primary", theme.colors.primary);
  root.style.setProperty("--brand-secondary", theme.colors.secondary);
  root.style.setProperty("--brand-accent", theme.colors.accent);
  root.style.setProperty("--brand-primary-rgb", `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
  root.style.setProperty("--brand-secondary-rgb", `${secondaryRgb.r}, ${secondaryRgb.g}, ${secondaryRgb.b}`);
  root.style.setProperty("--brand-accent-rgb", `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
  root.style.setProperty("--brand-on-accent", theme.colors.onAccent);
  root.style.setProperty("--brand-primary-soft", theme.colors.primarySoft);
  root.style.setProperty("--brand-secondary-soft", theme.colors.secondarySoft);
  root.style.setProperty("--brand-accent-soft", theme.colors.accentSoft);
  root.style.setProperty("--surface-page", theme.colors.surfacePage);
  root.style.setProperty("--surface-page-soft", "#0b1117");
  root.style.setProperty("--surface-card", theme.colors.surfaceCard);
  root.style.setProperty("--surface-muted", theme.colors.surfaceMuted);
  root.style.setProperty("--surface-raised", "#1a2430");
  root.style.setProperty("--surface-track", "#263242");
  root.style.setProperty("--surface-control", "#0b1117");
  root.style.setProperty("--surface-control-soft", "#111a23");
  root.style.setProperty("--surface-control-raised", "#1a2430");
  root.style.setProperty("--text-primary", theme.colors.textPrimary);
  root.style.setProperty("--text-secondary", theme.colors.textSecondary);
  root.style.setProperty("--text-muted", "#aeb7c4");
  root.style.setProperty("--text-on-dark", theme.colors.textPrimary);
  root.style.setProperty("--text-on-dark-muted", "rgba(246,247,243,0.84)");
  root.style.setProperty("--border-default", theme.colors.borderDefault);
  root.style.setProperty("--border-strong", "rgba(255,255,255,0.24)");
  root.style.setProperty("--border-on-dark", "rgba(255,255,255,0.14)");
  root.lang = theme.language || "it";

  const link =
    (document.querySelector("link[rel='icon']") as HTMLLinkElement | null) ||
    document.createElement("link");
  link.rel = "icon";
  link.href = theme.faviconUrl || brandConfig.faviconPath;
  if (!link.parentNode) document.head.appendChild(link);

  let metaTheme = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.content = theme.colors.surfacePage;
}

export function dispatchBrandingRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("branding:refresh"));
  }
}
