export type LanguageCode = "it" | "en" | "fr" | "es" | "de";

export const LANGUAGE_STORAGE_KEY = "parco-auto-language";

export const SUPPORTED_LANGUAGES: Array<{
  code: LanguageCode;
  label: string;
  shortLabel: string;
}> = [
  { code: "it", label: "Italiano", shortLabel: "IT" },
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "fr", label: "Français", shortLabel: "FR" },
  { code: "es", label: "Español", shortLabel: "ES" },
  { code: "de", label: "Deutsch", shortLabel: "DE" },
];

export function normalizeLanguage(value?: string | null): LanguageCode {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .split("-")[0];

  return SUPPORTED_LANGUAGES.some((language) => language.code === normalized)
    ? (normalized as LanguageCode)
    : "it";
}

export function getLanguageLabel(code?: string | null) {
  const language = normalizeLanguage(code);
  return SUPPORTED_LANGUAGES.find((item) => item.code === language)?.label || "Italiano";
}

type TranslationMap = Record<string, string>;

const APP_TRANSLATIONS: Record<LanguageCode, TranslationMap> = {
  it: {
    "language.current": "Lingua corrente",
    "language.selector": "Lingua",
    "language.platform": "Lingua piattaforma",
    "language.helper": "Scegli la lingua dell'interfaccia. La scelta viene salvata sul dispositivo e, dal Control Center, anche nel team.",
    "common.dashboard": "Dashboard",
    "common.platform": "piattaforma",
    "common.team": "team",
    "common.role": "Ruolo",
    "common.core": "Core",
    "common.logout": "Logout",
    "common.openMenu": "Apri menu",
    "common.allOperational": "Tutto operativo",
    "common.systemSynced": "Sistema sincronizzato",
    "common.save": "Salva",
    "common.cancel": "Annulla",
    "common.close": "Chiudi",
    "common.delete": "Elimina",
    "common.edit": "Modifica",
    "common.add": "Aggiungi",
    "common.search": "Cerca",
    "common.loading": "Caricamento",
    "common.error": "Errore",
    "common.confirm": "Conferma",
    "module.cars": "Auto",
    "module.components": "Componenti",
    "module.mounts": "Montaggi",
    "module.maintenances": "Manutenzioni",
    "module.events": "Eventi",
    "module.drivers": "Piloti",
    "module.inventory": "Magazzino",
    "module.telemetry": "Telemetria",
    "module.tasks": "Attività",
    "module.attendance": "Presenze",
    "module.settings": "Impostazioni",
    "module.teamAccess": "Team & Accessi",
    "module.documents": "Documenti",
  },
  en: {
    "language.current": "Current language",
    "language.selector": "Language",
    "language.platform": "Platform language",
    "language.helper": "Choose the interface language. The choice is saved on this device and, from the Control Center, also for the team.",
    "common.dashboard": "Dashboard",
    "common.platform": "platform",
    "common.team": "team",
    "common.role": "Role",
    "common.core": "Core",
    "common.logout": "Logout",
    "common.openMenu": "Open menu",
    "common.allOperational": "All operational",
    "common.systemSynced": "System synchronized",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.add": "Add",
    "common.search": "Search",
    "common.loading": "Loading",
    "common.error": "Error",
    "common.confirm": "Confirm",
    "module.cars": "Cars",
    "module.components": "Components",
    "module.mounts": "Mounts",
    "module.maintenances": "Maintenance",
    "module.events": "Events",
    "module.drivers": "Drivers",
    "module.inventory": "Inventory",
    "module.telemetry": "Telemetry",
    "module.tasks": "Tasks",
    "module.attendance": "Attendance",
    "module.settings": "Settings",
    "module.teamAccess": "Team & Access",
    "module.documents": "Documents",
  },
  fr: {
    "language.current": "Langue actuelle",
    "language.selector": "Langue",
    "language.platform": "Langue de la plateforme",
    "language.helper": "Choisissez la langue de l'interface. Le choix est enregistré sur cet appareil et, depuis le Control Center, aussi pour l'équipe.",
    "common.dashboard": "Tableau de bord",
    "common.platform": "plateforme",
    "common.team": "équipe",
    "common.role": "Rôle",
    "common.core": "Core",
    "common.logout": "Déconnexion",
    "common.openMenu": "Ouvrir le menu",
    "common.allOperational": "Tout est opérationnel",
    "common.systemSynced": "Système synchronisé",
    "common.save": "Enregistrer",
    "common.cancel": "Annuler",
    "common.close": "Fermer",
    "common.delete": "Supprimer",
    "common.edit": "Modifier",
    "common.add": "Ajouter",
    "common.search": "Rechercher",
    "common.loading": "Chargement",
    "common.error": "Erreur",
    "common.confirm": "Confirmer",
    "module.cars": "Voitures",
    "module.components": "Composants",
    "module.mounts": "Montages",
    "module.maintenances": "Maintenance",
    "module.events": "Événements",
    "module.drivers": "Pilotes",
    "module.inventory": "Stock",
    "module.telemetry": "Télémétrie",
    "module.tasks": "Tâches",
    "module.attendance": "Présences",
    "module.settings": "Paramètres",
    "module.teamAccess": "Équipe & Accès",
    "module.documents": "Documents",
  },
  es: {
    "language.current": "Idioma actual",
    "language.selector": "Idioma",
    "language.platform": "Idioma de la plataforma",
    "language.helper": "Elige el idioma de la interfaz. La elección se guarda en este dispositivo y, desde el Control Center, también para el equipo.",
    "common.dashboard": "Panel",
    "common.platform": "plataforma",
    "common.team": "equipo",
    "common.role": "Rol",
    "common.core": "Core",
    "common.logout": "Cerrar sesión",
    "common.openMenu": "Abrir menú",
    "common.allOperational": "Todo operativo",
    "common.systemSynced": "Sistema sincronizado",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.close": "Cerrar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.add": "Añadir",
    "common.search": "Buscar",
    "common.loading": "Cargando",
    "common.error": "Error",
    "common.confirm": "Confirmar",
    "module.cars": "Coches",
    "module.components": "Componentes",
    "module.mounts": "Montajes",
    "module.maintenances": "Mantenimiento",
    "module.events": "Eventos",
    "module.drivers": "Pilotos",
    "module.inventory": "Almacén",
    "module.telemetry": "Telemetría",
    "module.tasks": "Tareas",
    "module.attendance": "Presencias",
    "module.settings": "Configuración",
    "module.teamAccess": "Equipo y Accesos",
    "module.documents": "Documentos",
  },
  de: {
    "language.current": "Aktuelle Sprache",
    "language.selector": "Sprache",
    "language.platform": "Plattformsprache",
    "language.helper": "Wähle die Sprache der Oberfläche. Die Auswahl wird auf diesem Gerät und im Control Center auch für das Team gespeichert.",
    "common.dashboard": "Dashboard",
    "common.platform": "plattform",
    "common.team": "team",
    "common.role": "Rolle",
    "common.core": "Core",
    "common.logout": "Abmelden",
    "common.openMenu": "Menü öffnen",
    "common.allOperational": "Alles betriebsbereit",
    "common.systemSynced": "System synchronisiert",
    "common.save": "Speichern",
    "common.cancel": "Abbrechen",
    "common.close": "Schließen",
    "common.delete": "Löschen",
    "common.edit": "Bearbeiten",
    "common.add": "Hinzufügen",
    "common.search": "Suchen",
    "common.loading": "Laden",
    "common.error": "Fehler",
    "common.confirm": "Bestätigen",
    "module.cars": "Fahrzeuge",
    "module.components": "Komponenten",
    "module.mounts": "Montagen",
    "module.maintenances": "Wartung",
    "module.events": "Events",
    "module.drivers": "Fahrer",
    "module.inventory": "Lager",
    "module.telemetry": "Telemetrie",
    "module.tasks": "Aufgaben",
    "module.attendance": "Anwesenheit",
    "module.settings": "Einstellungen",
    "module.teamAccess": "Team & Zugänge",
    "module.documents": "Dokumente",
  },
};

export function translateKey(
  key: string,
  language: LanguageCode | string | null | undefined,
  fallback?: string
) {
  const normalizedLanguage = normalizeLanguage(language);
  return (
    APP_TRANSLATIONS[normalizedLanguage]?.[key] ||
    APP_TRANSLATIONS.it[key] ||
    fallback ||
    key
  );
}

type LegacyTextTranslations = Record<LanguageCode, string>;

const LEGACY_UI_TEXTS: LegacyTextTranslations[] = [
  texts("Dashboard", "Dashboard", "Tableau de bord", "Panel", "Dashboard"),
  texts("Auto", "Cars", "Voitures", "Coches", "Fahrzeuge"),
  texts("Componenti", "Components", "Composants", "Componentes", "Komponenten"),
  texts("Montaggi", "Mounts", "Montages", "Montajes", "Montagen"),
  texts("Manutenzioni", "Maintenance", "Maintenance", "Mantenimiento", "Wartung"),
  texts("Eventi", "Events", "Événements", "Eventos", "Events"),
  texts("Piloti", "Drivers", "Pilotes", "Pilotos", "Fahrer"),
  texts("Magazzino", "Inventory", "Stock", "Almacén", "Lager"),
  texts("Telemetria", "Telemetry", "Télémétrie", "Telemetría", "Telemetrie"),
  texts("Attività", "Tasks", "Tâches", "Tareas", "Aufgaben"),
  texts("Presenze", "Attendance", "Présences", "Presencias", "Anwesenheit"),
  texts("Impostazioni", "Settings", "Paramètres", "Configuración", "Einstellungen"),
  texts("Team & Accessi", "Team & Access", "Équipe & Accès", "Equipo y Accesos", "Team & Zugänge"),
  texts("Documenti", "Documents", "Documents", "Documentos", "Dokumente"),
  texts("Control Center", "Control Center", "Control Center", "Control Center", "Control Center"),
  texts("Lingua", "Language", "Langue", "Idioma", "Sprache"),
  texts("Lingua piattaforma", "Platform language", "Langue de la plateforme", "Idioma de la plataforma", "Plattformsprache"),
  texts("Identità team", "Team identity", "Identité de l'équipe", "Identidad del equipo", "Teamidentität"),
  texts("Nome team", "Team name", "Nom de l'équipe", "Nombre del equipo", "Teamname"),
  texts("Sottotitolo team", "Team subtitle", "Sous-titre de l'équipe", "Subtítulo del equipo", "Team-Untertitel"),
  texts("Logo sidebar", "Sidebar logo", "Logo de la barre latérale", "Logo de la barra lateral", "Sidebar-Logo"),
  texts("Logo header", "Header logo", "Logo d'en-tête", "Logo del encabezado", "Header-Logo"),
  texts("Logo stampa", "Print logo", "Logo d'impression", "Logo de impresión", "Drucklogo"),
  texts("Salva", "Save", "Enregistrer", "Guardar", "Speichern"),
  texts("Salva impostazioni", "Save settings", "Enregistrer les paramètres", "Guardar configuración", "Einstellungen speichern"),
  texts("Annulla", "Cancel", "Annuler", "Cancelar", "Abbrechen"),
  texts("Chiudi", "Close", "Fermer", "Cerrar", "Schließen"),
  texts("Elimina", "Delete", "Supprimer", "Eliminar", "Löschen"),
  texts("Modifica", "Edit", "Modifier", "Editar", "Bearbeiten"),
  texts("Aggiungi", "Add", "Ajouter", "Añadir", "Hinzufügen"),
  texts("Cerca", "Search", "Rechercher", "Buscar", "Suchen"),
  texts("Conferma", "Confirm", "Confirmer", "Confirmar", "Bestätigen"),
  texts("Caricamento", "Loading", "Chargement", "Cargando", "Laden"),
  texts("Errore", "Error", "Erreur", "Error", "Fehler"),
  texts("Aggiorna", "Refresh", "Actualiser", "Actualizar", "Aktualisieren"),
  texts("Nuovo", "New", "Nouveau", "Nuevo", "Neu"),
  texts("Nuova", "New", "Nouvelle", "Nueva", "Neu"),
  texts("Dettagli", "Details", "Détails", "Detalles", "Details"),
  texts("Stato", "Status", "Statut", "Estado", "Status"),
  texts("Data", "Date", "Date", "Fecha", "Datum"),
  texts("Ore", "Hours", "Heures", "Horas", "Stunden"),
  texts("Minuti", "Minutes", "Minutes", "Minutos", "Minuten"),
  texts("Scadenza", "Expiry", "Échéance", "Vencimiento", "Ablauf"),
  texts("Scadenze", "Expiries", "Échéances", "Vencimientos", "Abläufe"),
  texts("Nessun dato", "No data", "Aucune donnée", "Sin datos", "Keine Daten"),
  texts("Nessun risultato", "No results", "Aucun résultat", "Sin resultados", "Keine Ergebnisse"),
  texts("Tutto operativo", "All operational", "Tout est opérationnel", "Todo operativo", "Alles betriebsbereit"),
  texts("Sistema sincronizzato", "System synchronized", "Système synchronisé", "Sistema sincronizado", "System synchronisiert"),
  texts("piattaforma", "platform", "plateforme", "plataforma", "plattform"),
  texts("team", "team", "équipe", "equipo", "team"),
  texts("Ruolo", "Role", "Rôle", "Rol", "Rolle"),
  texts("Core", "Core", "Core", "Core", "Core"),
  texts("Logout", "Logout", "Déconnexion", "Cerrar sesión", "Abmelden"),
  texts("Carica file", "Upload file", "Téléverser un fichier", "Subir archivo", "Datei hochladen"),
  texts("Elimina file", "Delete file", "Supprimer le fichier", "Eliminar archivo", "Datei löschen"),
  texts("Vista compatta", "Compact view", "Vue compacte", "Vista compacta", "Kompakte Ansicht"),
  texts("Elenco file", "File list", "Liste des fichiers", "Lista de archivos", "Dateiliste"),
  texts("Nessun file caricato", "No files uploaded", "Aucun fichier téléversé", "No hay archivos subidos", "Keine Dateien hochgeladen"),
  texts("Aggiungi auto", "Add car", "Ajouter une voiture", "Añadir coche", "Fahrzeug hinzufügen"),
  texts("Modifica auto", "Edit car", "Modifier la voiture", "Editar coche", "Fahrzeug bearbeiten"),
  texts("Aggiungi componente", "Add component", "Ajouter un composant", "Añadir componente", "Komponente hinzufügen"),
  texts("Aggiungi evento", "Add event", "Ajouter un événement", "Añadir evento", "Event hinzufügen"),
  texts("Aggiungi revisione", "Add revision", "Ajouter une révision", "Añadir revisión", "Revision hinzufügen"),
  texts("Nuovo turno", "New session", "Nouvelle session", "Nueva sesión", "Neue Session"),
  texts("Minuti turno", "Session minutes", "Minutes de session", "Minutos de sesión", "Session-Minuten"),
  texts("Circuito", "Track", "Circuit", "Circuito", "Strecke"),
  texts("Prontezza · Auto", "Readiness · Cars", "Préparation · Voitures", "Preparación · Coches", "Bereitschaft · Fahrzeuge"),
  texts("Criticità · Componente", "Critical issues · Components", "Criticités · Composants", "Críticas · Componentes", "Kritische Punkte · Komponenten"),
  texts("Calendario · Evento", "Calendar · Events", "Calendrier · Événements", "Calendario · Eventos", "Kalender · Events"),
  texts("Da completare · Manutenzione", "To complete · Maintenance", "À compléter · Maintenance", "Por completar · Mantenimiento", "Zu erledigen · Wartung"),
  texts("Documenti · Pilota", "Documents · Drivers", "Documents · Pilotes", "Documentos · Pilotos", "Dokumente · Fahrer"),
  texts("Aperte · Attività", "Open · Tasks", "Ouvertes · Tâches", "Abiertas · Tareas", "Offen · Aufgaben"),
  texts("Sotto soglia · Magazzino", "Below threshold · Inventory", "Sous le seuil · Stock", "Bajo umbral · Almacén", "Unter Grenzwert · Lager"),
  texts("Oggi · Presenze", "Today · Attendance", "Aujourd'hui · Présences", "Hoy · Presencias", "Heute · Anwesenheit"),
  texts("Mezzi pronti", "Ready vehicles", "Véhicules prêts", "Vehículos listos", "Bereite Fahrzeuge"),
  texts("Componenti critici", "Critical components", "Composants critiques", "Componentes críticos", "Kritische Komponenten"),
  texts("Prossimi eventi", "Upcoming events", "Prochains événements", "Próximos eventos", "Nächste Events"),
  texts("Manutenzioni aperte", "Open maintenance", "Maintenance ouverte", "Mantenimientos abiertos", "Offene Wartung"),
  texts("Documenti piloti", "Driver documents", "Documents pilotes", "Documentos de pilotos", "Fahrerdokumente"),
  texts("Attività aperte", "Open tasks", "Tâches ouvertes", "Tareas abiertas", "Offene Aufgaben"),
  texts("Magazzino sotto soglia", "Inventory below threshold", "Stock sous le seuil", "Almacén bajo umbral", "Lager unter Grenzwert"),
  texts("Presenze oggi", "Attendance today", "Présences aujourd'hui", "Presencias hoy", "Anwesenheit heute"),
];

function texts(
  it: string,
  en: string,
  fr: string,
  es: string,
  de: string
): LegacyTextTranslations {
  return { it, en, fr, es, de };
}

function findLegacyText(value: string): LegacyTextTranslations | null {
  const normalized = value.trim();
  if (!normalized) return null;

  return (
    LEGACY_UI_TEXTS.find((entry) =>
      SUPPORTED_LANGUAGES.some((language) => entry[language.code] === normalized)
    ) || null
  );
}

function preserveOuterWhitespace(original: string, next: string) {
  const leading = original.match(/^\s*/)?.[0] || "";
  const trailing = original.match(/\s*$/)?.[0] || "";
  return `${leading}${next}${trailing}`;
}

export function translateKnownText(value: string, language: LanguageCode | string | null | undefined) {
  const targetLanguage = normalizeLanguage(language);
  const trimmed = value.trim();
  if (!trimmed) return value;

  const exact = findLegacyText(trimmed);
  if (exact) {
    return preserveOuterWhitespace(value, exact[targetLanguage]);
  }

  const rolePrefixes = [
    texts("Ruolo", "Role", "Rôle", "Rol", "Rolle"),
  ];

  for (const prefix of rolePrefixes) {
    for (const sourceLanguage of SUPPORTED_LANGUAGES) {
      const sourcePrefix = prefix[sourceLanguage.code];
      if (trimmed.startsWith(`${sourcePrefix}:`)) {
        return preserveOuterWhitespace(
          value,
          `${prefix[targetLanguage]}:${trimmed.slice(sourcePrefix.length + 1)}`
        );
      }
    }
  }

  return value;
}

export function translateElementAttributes(root: ParentNode, language: LanguageCode) {
  if (typeof document === "undefined") return;

  const elements = root.querySelectorAll<HTMLElement>("[placeholder], [title], [aria-label]");
  elements.forEach((element) => {
    if (element.closest("[data-no-translate='true']")) return;

    for (const attribute of ["placeholder", "title", "aria-label"] as const) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const translated = translateKnownText(value, language);
      if (translated !== value) {
        element.setAttribute(attribute, translated);
      }
    }
  });
}

export function translateDocumentText(language: LanguageCode | string | null | undefined) {
  if (typeof document === "undefined" || !document.body) return;

  const targetLanguage = normalizeLanguage(language);
  document.documentElement.lang = targetLanguage;
  document.documentElement.dataset.language = targetLanguage;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("[data-no-translate='true'], script, style, textarea")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  nodes.forEach((node) => {
    const currentValue = node.nodeValue || "";
    const translated = translateKnownText(currentValue, targetLanguage);
    if (translated !== currentValue) {
      node.nodeValue = translated;
    }
  });

  translateElementAttributes(document.body, targetLanguage);
}
