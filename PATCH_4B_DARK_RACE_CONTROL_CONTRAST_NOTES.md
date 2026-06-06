export type BrandConfig = {
  appName: string;
  appDescription: string;
  appTagline: string;
  marketingLabel: string;
  vendorName: string;
  copyrightName: string;
  defaultTeamName: string;
  defaultTeamSubtitle: string;
  defaultWorkspaceLabel: string;
  ownerTeamPlaceholder: string;
  loginHeroTitle: string;
  loginHeroDescription: string;
  logoPath: string;
  faviconPath: string;
  supportEmail: string | null;
  themeColor: string;
};

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : "";
}

function normalizeAssetPath(value: string, fallback: string) {
  if (!value) return fallback;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

const appName = readEnv("NEXT_PUBLIC_APP_NAME") || "Parco Auto";
const appTagline =
  readEnv("NEXT_PUBLIC_APP_TAGLINE") || "Gestione motorsport";
const appDescription =
  readEnv("NEXT_PUBLIC_APP_DESCRIPTION") ||
  "Piattaforma motorsport modulare e configurabile";
const marketingLabel =
  readEnv("NEXT_PUBLIC_APP_MARKETING_LABEL") || "Motorsport Operating System";
const vendorName =
  readEnv("NEXT_PUBLIC_APP_VENDOR_NAME") || "Battaglia Racing Car";
const copyrightName =
  readEnv("NEXT_PUBLIC_APP_COPYRIGHT_NAME") || vendorName;
const defaultTeamSubtitle =
  readEnv("NEXT_PUBLIC_APP_DEFAULT_TEAM_SUBTITLE") || appTagline;
const defaultTeamName =
  readEnv("NEXT_PUBLIC_APP_DEFAULT_TEAM_NAME") || appName;
const defaultWorkspaceLabel =
  readEnv("NEXT_PUBLIC_APP_DEFAULT_WORKSPACE_LABEL") || `${appName} Workspace`;
const ownerTeamPlaceholder =
  readEnv("NEXT_PUBLIC_APP_OWNER_TEAM_PLACEHOLDER") || "Es. Team principale";
const loginHeroTitle =
  readEnv("NEXT_PUBLIC_APP_LOGIN_HERO_TITLE") ||
  "La piattaforma configurabile per gestire mezzi, componenti, eventi, check tecnici e lavoro in pista.";
const loginHeroDescription =
  readEnv("NEXT_PUBLIC_APP_LOGIN_HERO_DESCRIPTION") ||
  "Multi-team, ruoli, template mezzo, dashboard operative e control center: una base pensata per officina, paddock e management.";
const logoPath = normalizeAssetPath(
  readEnv("NEXT_PUBLIC_APP_LOGO_PATH"),
  "/logo.png"
);
const faviconPath = normalizeAssetPath(
  readEnv("NEXT_PUBLIC_APP_FAVICON_PATH"),
  logoPath
);
const supportEmail = readEnv("NEXT_PUBLIC_APP_SUPPORT_EMAIL") || null;
const themeColor = readEnv("NEXT_PUBLIC_APP_THEME_COLOR") || "#facc15";

export const brandConfig: BrandConfig = {
  appName,
  appDescription,
  appTagline,
  marketingLabel,
  vendorName,
  copyrightName,
  defaultTeamName,
  defaultTeamSubtitle,
  defaultWorkspaceLabel,
  ownerTeamPlaceholder,
  loginHeroTitle,
  loginHeroDescription,
  logoPath,
  faviconPath,
  supportEmail,
  themeColor,
};
