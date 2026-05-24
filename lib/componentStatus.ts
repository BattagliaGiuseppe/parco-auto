export type ComponentStatusTone = "neutral" | "green" | "yellow" | "red" | "blue" | "purple";

export type ComponentStatusCode =
  | "expired"
  | "revision_due"
  | "warning"
  | "mounted"
  | "unmounted";

export type ComponentStatusInput = {
  expiry_date?: string | null;
  hours?: number | string | null;
  life_hours?: number | string | null;
  warning_threshold_hours?: number | string | null;
  revision_threshold_hours?: number | string | null;
  car_id?: string | null;
};

export type ComponentStatus = {
  code: ComponentStatusCode;
  label: string;
  tone: ComponentStatusTone;
  severity: number;
};

export type ComponentHoursInfo = {
  revisionHours: number;
  lifeHours: number;
  warningThreshold: number | null;
  revisionThreshold: number | null;
  remainingHours: number | null;
  progress: number | null;
};

export function toComponentNumber(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export function toOptionalComponentNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatComponentHours(value: number | string | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Number(value).toFixed(1)} h`;
}

export function getComponentHoursInfo(row: ComponentStatusInput): ComponentHoursInfo {
  const revisionHours = toComponentNumber(row.hours);
  const lifeHours = toComponentNumber(row.life_hours);
  const warningThreshold = toOptionalComponentNumber(row.warning_threshold_hours);
  const revisionThreshold = toOptionalComponentNumber(row.revision_threshold_hours);
  const remainingHours =
    revisionThreshold === null ? null : Math.max(0, revisionThreshold - revisionHours);
  const progress =
    revisionThreshold === null || revisionThreshold <= 0
      ? null
      : Math.min(100, Math.max(0, (revisionHours / revisionThreshold) * 100));

  return {
    revisionHours,
    lifeHours,
    warningThreshold,
    revisionThreshold,
    remainingHours,
    progress,
  };
}

function isExpired(expiryDate: string | null | undefined) {
  if (!expiryDate) return false;

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  return expiry < today;
}

function isExpiringSoon(expiryDate: string | null | undefined, warningDays: number) {
  if (!expiryDate) return false;

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const daysToExpiry = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysToExpiry >= 0 && daysToExpiry <= warningDays;
}

export function getComponentStatus(
  row: ComponentStatusInput,
  options: { expiryWarningDays?: number } = {}
): ComponentStatus {
  const { expiryWarningDays = 30 } = options;
  const info = getComponentHoursInfo(row);

  if (isExpired(row.expiry_date)) {
    return { code: "expired", label: "Scaduto", tone: "red", severity: 4 };
  }

  if (info.revisionThreshold !== null && info.revisionHours >= info.revisionThreshold) {
    return {
      code: "revision_due",
      label: "Revisione necessaria",
      tone: "red",
      severity: 4,
    };
  }

  if (
    (info.warningThreshold !== null && info.revisionHours >= info.warningThreshold) ||
    isExpiringSoon(row.expiry_date, expiryWarningDays)
  ) {
    return { code: "warning", label: "Attenzione", tone: "yellow", severity: 3 };
  }

  if (row.car_id) {
    return { code: "mounted", label: "Montato", tone: "blue", severity: 1 };
  }

  return { code: "unmounted", label: "Smontato", tone: "neutral", severity: 0 };
}

export function getDashboardComponentSeverity(row: ComponentStatusInput) {
  const status = getComponentStatus(row);

  if (status.severity >= 4) return 3;
  if (status.severity >= 3) return 2;

  return 1;
}

export function isComponentUrgent(row: ComponentStatusInput) {
  return getComponentStatus(row).severity >= 4;
}

export function isComponentWarning(row: ComponentStatusInput) {
  return getComponentStatus(row).severity === 3;
}
