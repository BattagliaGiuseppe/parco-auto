export type ControlCenterLabelKey =
  | "vehicle"
  | "driver"
  | "event"
  | "turn"
  | "component"
  | "maintenance"
  | "inventory"
  | "mounts"
  | "telemetry"
  | "tasks"
  | "attendance"
  | "settings"
  | "team_access"
  | "documents";

export type ControlCenterLabels = Record<ControlCenterLabelKey, string>;

export const DEFAULT_CONTROL_CENTER_LABELS: ControlCenterLabels = {
  vehicle: "Auto",
  driver: "Pilota",
  event: "Evento",
  turn: "Turno",
  component: "Componente",
  maintenance: "Manutenzione",
  inventory: "Magazzino",
  mounts: "Montaggi",
  telemetry: "Telemetria",
  tasks: "Attività",
  attendance: "Presenze",
  settings: "Impostazioni",
  team_access: "Team & Accessi",
  documents: "Documenti",
};

export type ModuleId =
  | "cars"
  | "components"
  | "mounts"
  | "maintenances"
  | "events"
  | "drivers"
  | "inventory"
  | "telemetry"
  | "documents"
  | "tasks"
  | "attendance"
  | "settings"
  | "team_access";

export type ModuleRegistryItem = {
  id: ModuleId;
  labelKey: ControlCenterLabelKey | "dashboard";
  fallbackLabel: string;
  route: string;
  permission?: string;
  defaultEnabled: boolean;
  visibleInControlCenter: boolean;
  description: string;
  dependsOn?: ModuleId[];
  legacyFlag?: "enable_events" | "enable_maintenances";
};

export const MODULE_REGISTRY: ModuleRegistryItem[] = [
  {
    id: "cars",
    labelKey: "vehicle",
    fallbackLabel: "Auto",
    route: "/cars",
    permission: "cars.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    description: "Anagrafica mezzi, ore, componenti montati e schede operative.",
  },
  {
    id: "components",
    labelKey: "component",
    fallbackLabel: "Componenti",
    route: "/components",
    permission: "components.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    description: "Componenti tecnici, ore vita, revisioni, stato e soglie.",
    dependsOn: ["cars"],
  },
  {
    id: "mounts",
    labelKey: "mounts",
    fallbackLabel: "Montaggi",
    route: "/mounts",
    permission: "mounts.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    description: "Storico montaggi/smontaggi e componenti attivi sui mezzi.",
    dependsOn: ["cars", "components"],
  },
  {
    id: "maintenances",
    labelKey: "maintenance",
    fallbackLabel: "Manutenzioni",
    route: "/maintenances",
    permission: "maintenances.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    legacyFlag: "enable_maintenances",
    description: "Interventi tecnici, priorità, revisioni e storico lavori.",
    dependsOn: ["cars", "components"],
  },
  {
    id: "events",
    labelKey: "event",
    fallbackLabel: "Eventi",
    route: "/calendar",
    permission: "events.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    legacyFlag: "enable_events",
    description: "Calendario, mezzi evento, turni tecnici, setup e checklist.",
    dependsOn: ["cars"],
  },
  {
    id: "drivers",
    labelKey: "driver",
    fallbackLabel: "Piloti",
    route: "/drivers",
    permission: "drivers.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    description: "Anagrafica piloti, documenti, scadenze e performance.",
  },
  {
    id: "inventory",
    labelKey: "inventory",
    fallbackLabel: "Magazzino",
    route: "/inventory",
    permission: "inventory.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    description: "Ricambi, scorte minime, movimenti e articoli da ordinare.",
  },
  {
    id: "telemetry",
    labelKey: "telemetry",
    fallbackLabel: "Telemetria",
    route: "/telemetry",
    permission: "telemetry.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    description: "Import file, analisi giri, canali e confronto dati in pista.",
    dependsOn: ["cars", "events"],
  },
  {
    id: "documents",
    labelKey: "documents",
    fallbackLabel: "Documenti",
    route: "/cars",
    defaultEnabled: true,
    visibleInControlCenter: true,
    description: "Archivi documentali collegati a mezzi, piloti e team.",
  },
  {
    id: "tasks",
    labelKey: "tasks",
    fallbackLabel: "Attività",
    route: "/tasks",
    permission: "tasks.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    description: "Promemoria operativi, assegnazioni e cose da fare per area.",
  },
  {
    id: "attendance",
    labelKey: "attendance",
    fallbackLabel: "Presenze",
    route: "/attendance",
    permission: "attendance.view",
    defaultEnabled: true,
    visibleInControlCenter: true,
    description: "Presenze, timbrature, ore periodo e kiosk/QR.",
  },
  {
    id: "settings",
    labelKey: "settings",
    fallbackLabel: "Impostazioni",
    route: "/settings",
    permission: "settings.manage",
    defaultEnabled: true,
    visibleInControlCenter: false,
    description: "Control Center del team.",
  },
  {
    id: "team_access",
    labelKey: "team_access",
    fallbackLabel: "Team & Accessi",
    route: "/settings/team",
    permission: "team.manage",
    defaultEnabled: true,
    visibleInControlCenter: false,
    description: "Membri, ruoli, permessi e accessi al team.",
  },
];

export type DashboardWidgetCode =
  | "cars_ready"
  | "components_alerts"
  | "upcoming_events"
  | "maintenances_open"
  | "drivers_documents"
  | "tasks_open"
  | "inventory_low_stock"
  | "attendance_today";

export type DashboardWidgetMeta = {
  code: DashboardWidgetCode;
  label: string;
  description: string;
  defaultSize: "sm" | "md" | "lg" | "xl";
  requiredModule?: ModuleId;
  recommendedRoles?: string[];
};

export const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetMeta[] = [
  { code: "cars_ready", label: "Mezzi pronti", description: "Prontezza dei mezzi rispetto ai warning componente.", defaultSize: "md", requiredModule: "cars" },
  { code: "components_alerts", label: "Componenti critici", description: "Componenti in warning, urgenti o fuori soglia.", defaultSize: "md", requiredModule: "components" },
  { code: "upcoming_events", label: "Prossimi eventi", description: "Calendario dei prossimi appuntamenti del team.", defaultSize: "md", requiredModule: "events" },
  { code: "maintenances_open", label: "Manutenzioni aperte", description: "Interventi non completati o da pianificare.", defaultSize: "md", requiredModule: "maintenances" },
  { code: "drivers_documents", label: "Documenti piloti", description: "Documenti in scadenza o da verificare.", defaultSize: "md", requiredModule: "drivers" },
  { code: "tasks_open", label: "Attività aperte", description: "Promemoria operativi e attività non chiuse.", defaultSize: "md", requiredModule: "tasks" },
  { code: "inventory_low_stock", label: "Magazzino sotto soglia", description: "Articoli con quantità uguale o inferiore alla scorta minima.", defaultSize: "md", requiredModule: "inventory" },
  { code: "attendance_today", label: "Presenze oggi", description: "Persone presenti, in pista e ore registrate oggi.", defaultSize: "sm", requiredModule: "attendance", recommendedRoles: ["owner", "admin"] },
];

export type RawControlCenterSettings = {
  modules?: Record<string, boolean> | null;
  labels?: Partial<Record<ControlCenterLabelKey, string>> | null;
  enable_events?: boolean | null;
  enable_maintenances?: boolean | null;
};

export function normalizeControlCenterLabels(labels?: RawControlCenterSettings["labels"]): ControlCenterLabels {
  return {
    ...DEFAULT_CONTROL_CENTER_LABELS,
    ...(labels || {}),
  };
}

export function getControlCenterLabel(labels: Partial<Record<ControlCenterLabelKey, string>> | null | undefined, key: ControlCenterLabelKey) {
  const normalized = normalizeControlCenterLabels(labels);
  return normalized[key] || DEFAULT_CONTROL_CENTER_LABELS[key];
}

export function normalizeControlCenterModules(settings?: RawControlCenterSettings | null) {
  const raw = settings?.modules || {};
  const normalized = Object.fromEntries(
    MODULE_REGISTRY.map((module) => [module.id, module.defaultEnabled])
  ) as Record<ModuleId, boolean>;

  for (const module of MODULE_REGISTRY) {
    if (typeof raw[module.id] === "boolean") {
      normalized[module.id] = raw[module.id];
      continue;
    }
    if (module.legacyFlag === "enable_events" && typeof settings?.enable_events === "boolean") {
      normalized[module.id] = settings.enable_events;
      continue;
    }
    if (module.legacyFlag === "enable_maintenances" && typeof settings?.enable_maintenances === "boolean") {
      normalized[module.id] = settings.enable_maintenances;
    }
  }

  for (const module of MODULE_REGISTRY) {
    if (!module.dependsOn?.length) continue;
    if (module.dependsOn.some((dep) => normalized[dep] === false)) {
      normalized[module.id] = false;
    }
  }

  return normalized;
}

export function isModuleEnabled(settings: RawControlCenterSettings | null | undefined, moduleId: ModuleId) {
  return normalizeControlCenterModules(settings)[moduleId] !== false;
}

export function getModuleLabel(
  moduleId: ModuleId,
  labels?: Partial<Record<ControlCenterLabelKey, string>> | null
) {
  const module = MODULE_REGISTRY.find((item) => item.id === moduleId);
  if (!module) return moduleId;
  if (module.labelKey === "dashboard") return module.fallbackLabel;
  return getControlCenterLabel(labels, module.labelKey) || module.fallbackLabel;
}

export function getDashboardWidgetMeta(code: string) {
  return DASHBOARD_WIDGET_REGISTRY.find((item) => item.code === code) || null;
}

export function getDashboardWidgetLabel(code: string) {
  return getDashboardWidgetMeta(code)?.label || "Widget dashboard";
}


export type DashboardWidgetLabelMode = "auto" | "custom";

export type DashboardWidgetLabelLike = {
  widget_code: string;
  label?: string | null;
  config?: Record<string, unknown> | null;
};

export function safeLowerLabel(value: string | null | undefined) {
  return String(value || "").trim().toLocaleLowerCase("it-IT");
}

export function getDashboardWidgetAutoLabel(
  code: string,
  labels?: Partial<Record<ControlCenterLabelKey, string>> | null
) {
  const normalized = normalizeControlCenterLabels(labels);
  // Le label automatiche evitano aggettivi maschile/femminile/plurale.
  // In questo modo la terminologia globale può essere "Auto", "Mezzi",
  // "Vetture", "Ricambi", ecc. senza creare frasi grammaticalmente errate.
  switch (code) {
    case "cars_ready":
      return `Prontezza · ${normalized.vehicle}`;
    case "components_alerts":
      return `Criticità · ${normalized.component}`;
    case "upcoming_events":
      return `Calendario · ${normalized.event}`;
    case "maintenances_open":
      return `Da completare · ${normalized.maintenance}`;
    case "drivers_documents":
      return `Documenti · ${normalized.driver}`;
    case "tasks_open":
      return `Aperte · ${normalized.tasks}`;
    case "inventory_low_stock":
      return `Sotto soglia · ${normalized.inventory}`;
    case "attendance_today":
      return `Oggi · ${normalized.attendance}`;
    default:
      return getDashboardWidgetLabel(code);
  }
}

export function getDashboardWidgetLabelMode(
  widget: DashboardWidgetLabelLike,
  labels?: Partial<Record<ControlCenterLabelKey, string>> | null
): DashboardWidgetLabelMode {
  const configuredMode = typeof widget.config?.label_mode === "string" ? widget.config.label_mode : null;
  if (configuredMode === "custom") return "custom";
  if (configuredMode === "auto") return "auto";

  const currentLabel = (widget.label || "").trim();
  if (!currentLabel) return "auto";

  const defaultLabels = DEFAULT_CONTROL_CENTER_LABELS;
  const knownAutomaticLabels = new Set([
    getDashboardWidgetLabel(widget.widget_code),
    getDashboardWidgetAutoLabel(widget.widget_code, defaultLabels),
    getDashboardWidgetAutoLabel(widget.widget_code, labels),
    widget.widget_code,
  ].map((value) => String(value || "").trim()).filter(Boolean));

  return knownAutomaticLabels.has(currentLabel) ? "auto" : "custom";
}

export function getDashboardWidgetDisplayLabel(
  widget: DashboardWidgetLabelLike,
  labels?: Partial<Record<ControlCenterLabelKey, string>> | null
) {
  return getDashboardWidgetLabelMode(widget, labels) === "custom"
    ? (widget.label || "Widget").trim() || "Widget"
    : getDashboardWidgetAutoLabel(widget.widget_code, labels);
}

export function normalizeWidgetSize(value?: string | null): "sm" | "md" | "lg" | "xl" {
  return value === "sm" || value === "lg" || value === "xl" ? value : "md";
}

export function dashboardWidgetClassName(size?: string | null) {
  switch (normalizeWidgetSize(size)) {
    case "sm":
      // Vista compatta: utile solo su schermi molto larghi; su desktop normali resta leggibile.
      return "min-w-0 xl:col-span-6 2xl:col-span-4";
    case "lg":
      // Ampio: sui desktop normali occupa tutta la riga per evitare widget stretti e troppo alti.
      return "min-w-0 xl:col-span-12 2xl:col-span-8";
    case "xl":
      return "min-w-0 xl:col-span-12";
    default:
      return "min-w-0 xl:col-span-6";
  }
}

export function isWidgetVisibleForRole(widgetRoleScope: string | null | undefined, role: string | null | undefined) {
  const scope = (widgetRoleScope || "all").trim().toLowerCase();
  if (!scope || scope === "all" || scope === "tutti") return true;
  if (!role) return false;
  return scope.split(/[;,\s]+/).map((item) => item.trim()).filter(Boolean).includes(role.toLowerCase());
}

export function normalizeOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
  return [];
}
