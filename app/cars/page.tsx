"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CarFront,
  Search,
  PlusCircle,
  Edit,
  FileText,
  Printer,
  Settings2,
  Boxes,
  Info,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { uploadTeamFile } from "@/lib/storage";
import { useBrandTheme } from "@/components/providers/BrandThemeProvider";
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import PagePermissionState from "@/components/PagePermissionState";
import { Button } from "@/components/Button";
import ViewModeToggle from "@/components/ViewModeToggle";
import { usePersistedViewMode } from "@/lib/usePersistedViewMode";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { usePermissionAccess } from "@/lib/permissions";
import { formatComponentHours } from "@/lib/componentStatus";
import { safeLowerLabel } from "@/lib/controlCenter";
import LocalizedText from "@/components/LocalizedText";

type CarRow = {
  id: string;
  name: string;
  chassis_number: string | null;
  hours: number | null;
  notes: string | null;
  image_url: string | null;
  components: ComponentRow[];
};

type ComponentRow = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  hours: number | null;
  life_hours: number | null;
  warning_threshold_hours: number | null;
  revision_threshold_hours: number | null;
};

type Definition = {
  id: string;
  code: string;
  label: string;
  category: string;
  is_required: boolean;
  tracks_hours: boolean;
  has_expiry: boolean;
  default_expiry_years: number | null;
  order_index: number;
};

type ComponentOption = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  car_id: string | null;
  car: { name: string } | { name: string }[] | null;
};

type ComponentForm = {
  mode: "existing" | "new";
  existingId: string;
  identifier: string;
  hours: string;
  life_hours: string;
  warning_threshold_hours: string;
  revision_threshold_hours: string;
  expiry_date: string;
  notes: string;
};

function normalizeCarName(value: ComponentOption["car"]) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name || null;
  return value.name || null;
}

function defaultComponentForm(expiryYears?: number | null): ComponentForm {
  const expiry = expiryYears
    ? (() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + expiryYears);
        return d.toISOString().slice(0, 10);
      })()
    : "";
  return {
    mode: "existing",
    existingId: "",
    identifier: "",
    hours: "0",
    life_hours: "",
    warning_threshold_hours: "",
    revision_threshold_hours: "",
    expiry_date: expiry,
    notes: "",
  };
}

function parseNumber(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getComponentStatus(component: ComponentRow) {
  const hours = Number(component.hours || 0);
  if (
    component.revision_threshold_hours !== null &&
    component.revision_threshold_hours !== undefined &&
    hours >= component.revision_threshold_hours
  ) {
    return { label: "Fuori soglia", tone: "red" as const };
  }
  if (
    component.warning_threshold_hours !== null &&
    component.warning_threshold_hours !== undefined &&
    hours >= component.warning_threshold_hours
  ) {
    return { label: "Attenzione", tone: "yellow" as const };
  }
  if (component.expiry_date && new Date(component.expiry_date) < new Date()) {
    return { label: "Scaduto", tone: "red" as const };
  }
  return { label: "OK", tone: "green" as const };
}

function getDefinitionCategoryCopy(definition: Definition) {
  const category = definition.category || "base";
  if (category === "expiry") {
    return {
      label: "Componente con scadenza",
      description:
        "Usalo per tute, cinture, serbatoi, estintori o altri elementi gestiti con data di validità.",
      tone: "purple" as const,
    };
  }
  if (category === "optional") {
    return {
      label: "Componente opzionale",
      description:
        "Non è obbligatorio su tutti i mezzi. Puoi lasciarlo vuoto se quella vettura non lo utilizza.",
      tone: "neutral" as const,
    };
  }
  return {
    label: "Componente base",
    description:
      "Fa parte dell’allestimento standard del mezzo. Se già disponibile, puoi selezionarlo; altrimenti creane uno nuovo.",
    tone: "blue" as const,
  };
}

export default function CarsPage() {
  const { t } = useLanguage();
  const tr = (value: string) => t(`ui.${value}`, value);
  const access = usePermissionAccess();
  const { theme } = useBrandTheme();
  const vehicleLabel = theme.labels.vehicle || "Auto";
  const vehicleLabelLower = safeLowerLabel(vehicleLabel);
  const canViewCars = access.hasPermission("cars.view");
  const canEditCars = access.hasPermission("cars.edit", ["owner", "admin"]);
  const [cars, setCars] = useState<CarRow[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [allComponents, setAllComponents] = useState<ComponentOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CarRow | null>(null);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [componentForms, setComponentForms] = useState<
    Record<string, ComponentForm>
  >({});
  const [toast, setToast] = useState("");
  const [viewMode, setViewMode] = usePersistedViewMode("cars-view-mode");

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [carsRes, defsRes, compsRes] = await Promise.all([
        supabase
          .from("cars")
          .select(
            `id,name,chassis_number,hours,notes,image_url,components(id,type,identifier,expiry_date,hours,life_hours,warning_threshold_hours,revision_threshold_hours)`,
          )
          .eq("team_id", ctx.teamId)
          .order("created_at", { ascending: false }),
        supabase
          .from("team_component_definitions")
          .select("*")
          .eq("team_id", ctx.teamId)
          .order("order_index", { ascending: true }),
        supabase
          .from("components")
          .select("id,type,identifier,expiry_date,car_id,car:car_id(name)")
          .eq("team_id", ctx.teamId)
          .order("identifier", { ascending: true }),
      ]);
      setCars(
        ((carsRes.data || []) as any[]).map((car) => ({
          ...car,
          components: car.components || [],
        })) as CarRow[],
      );
      setDefinitions((defsRes.data || []) as Definition[]);
      setAllComponents((compsRes.data || []) as ComponentOption[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewCars) {
      void loadAll();
    }
  }, [access.loading, canViewCars]);

  useEffect(() => {
    const next: Record<string, ComponentForm> = {};
    for (const def of definitions) {
      next[def.code] = defaultComponentForm(def.default_expiry_years);
    }
    setComponentForms(next);
  }, [definitions]);

  const stats = useMemo(
    () => [
      {
        label: vehicleLabel,
        value: String(cars.length),
        icon: <CarFront size={18} />,
      },
      {
        label: "Definizioni attive",
        value: String(definitions.length),
        icon: <Settings2 size={18} />,
      },
      {
        label: "Componenti disponibili",
        value: String(allComponents.length),
        icon: <Boxes size={18} />,
      },
      {
        label: "Con criticità",
        value: String(
          cars.reduce(
            (acc, car) =>
              acc +
              car.components.filter(
                (component) => getComponentStatus(component).label !== "OK",
              ).length,
            0,
          ),
        ),
        icon: <Search size={18} />,
      },
    ],
    [cars, definitions.length, allComponents.length, vehicleLabel],
  );

  const filteredCars = useMemo(() => {
    if (!search.trim()) return cars;
    const q = search.toLowerCase();
    return cars.filter(
      (car) =>
        car.name.toLowerCase().includes(q) ||
        (car.chassis_number || "").toLowerCase().includes(q),
    );
  }, [cars, search]);

  function openCreate() {
    if (!canEditCars) return;
    setEditing(null);
    setName("");
    setChassis("");
    setNotes("");
    setImageUrl("");
    setComponentForms(
      Object.fromEntries(
        definitions.map((def) => [
          def.code,
          defaultComponentForm(def.default_expiry_years),
        ]),
      ),
    );
    setOpen(true);
  }

  function openEdit(car: CarRow) {
    if (!canEditCars) return;
    const next: Record<string, ComponentForm> = {};
    for (const def of definitions) {
      const existing = car.components.find(
        (component) => component.type === def.code,
      );
      next[def.code] = existing
        ? {
            mode: "existing",
            existingId: existing.id,
            identifier: existing.identifier || "",
            hours: String(existing.hours || 0),
            life_hours: existing.life_hours ? String(existing.life_hours) : "",
            warning_threshold_hours:
              existing.warning_threshold_hours !== null &&
              existing.warning_threshold_hours !== undefined
                ? String(existing.warning_threshold_hours)
                : "",
            revision_threshold_hours:
              existing.revision_threshold_hours !== null &&
              existing.revision_threshold_hours !== undefined
                ? String(existing.revision_threshold_hours)
                : "",
            expiry_date: existing.expiry_date || "",
            notes: "",
          }
        : defaultComponentForm(def.default_expiry_years);
    }
    setEditing(car);
    setName(car.name);
    setChassis(car.chassis_number || "");
    setNotes(car.notes || "");
    setImageUrl(car.image_url || "");
    setComponentForms(next);
    setOpen(true);
  }

  function availableOptions(type: string, currentCarId?: string) {
    return allComponents.filter(
      (component) =>
        component.type === type &&
        (!component.car_id || component.car_id === currentCarId),
    );
  }

  async function createOrAttachComponents(carId: string) {
    const ctx = await getCurrentTeamContext();
    const mountedAt = new Date().toISOString().slice(0, 10);

    async function mountComponent(componentId: string, reason: string) {
      const { error } = await supabase.rpc("mount_component_on_car", {
        p_team_id: ctx.teamId,
        p_car_id: carId,
        p_component_id: componentId,
        p_mounted_at: mountedAt,
        p_mounted_by_team_user_id: ctx.teamUserId,
        p_reason: reason,
        p_replace_same_type: true,
      });

      if (error) throw error;
    }

    for (const def of definitions) {
      const form = componentForms[def.code];
      if (!form) continue;

      if (!def.is_required && !form.existingId && !form.identifier.trim()) {
        continue;
      }

      if (form.mode === "existing" && form.existingId) {
        await mountComponent(
          form.existingId,
          editing
            ? `Aggiornamento componente ${def.label || def.code} da scheda auto`
            : `Montaggio iniziale componente ${def.label || def.code} da creazione auto`,
        );
        continue;
      }

      if (form.mode === "new" && form.identifier.trim()) {
        const payload: any = {
          team_id: ctx.teamId,
          type: def.code,
          identifier: form.identifier.trim(),
          // Importante: il componente nasce libero.
          // Il collegamento all'auto viene fatto dalla RPC mount_component_on_car,
          // che crea anche lo storico in car_components.
          car_id: null,
          is_active: true,
          hours: parseNumber(form.hours),
          life_hours: form.life_hours ? parseNumber(form.life_hours) : 0,
          warning_threshold_hours: form.warning_threshold_hours
            ? parseNumber(form.warning_threshold_hours)
            : null,
          revision_threshold_hours: form.revision_threshold_hours
            ? parseNumber(form.revision_threshold_hours)
            : null,
          expiry_date: def.has_expiry ? form.expiry_date || null : null,
          notes: form.notes || null,
        };

        const { data, error } = await supabase
          .from("components")
          .insert([payload])
          .select("id")
          .single();

        if (error) throw error;

        await mountComponent(
          data.id,
          editing
            ? `Nuovo componente ${def.label || def.code} creato e montato da scheda auto`
            : `Nuovo componente ${def.label || def.code} creato durante creazione auto`,
        );
      }
    }
  }

  async function handleCarImageUpload(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Carica un file immagine valido.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert("Immagine troppo grande. Limite massimo 3 MB.");
      return;
    }

    setUploadingImage(true);
    try {
      const upload = await uploadTeamFile({
        file,
        area: "car-images",
        recordId: editing?.id || "new-car",
      });
      setImageUrl(upload.publicUrl);
    } catch (error) {
      console.error(error);
      alert("Errore caricamento immagine mezzo.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveCar() {
    if (!canEditCars) return;
    if (!name.trim() || !chassis.trim()) {
      alert("Inserisci almeno nome e telaio");
      return;
    }
    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      let carId = editing?.id;
      if (editing) {
        const { error } = await supabase
          .from("cars")
          .update({
            name: name.trim(),
            chassis_number: chassis.trim(),
            notes: notes || null,
            image_url: imageUrl || null,
          })
          .eq("team_id", ctx.teamId)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("cars")
          .insert([
            {
              team_id: ctx.teamId,
              name: name.trim(),
              chassis_number: chassis.trim(),
              notes: notes || null,
              image_url: imageUrl || null,
            },
          ])
          .select("id")
          .single();
        if (error) throw error;
        carId = data.id;
      }
      await createOrAttachComponents(carId!);
      setOpen(false);
      setToast("Scheda salvata");
      setTimeout(() => setToast(""), 2500);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Errore salvataggio scheda");
    } finally {
      setSaving(false);
    }
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title={vehicleLabel}
        subtitle={`Anagrafica ${vehicleLabelLower} e configurazione componenti`}
        icon={<CarFront size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title={vehicleLabel}
        subtitle={`Anagrafica ${vehicleLabelLower} e configurazione componenti`}
        icon={<CarFront size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewCars) {
    return (
      <PagePermissionState
        title={vehicleLabel}
        subtitle={`Anagrafica ${vehicleLabelLower} e configurazione componenti`}
        icon={<CarFront size={22} />}
        state="denied"
        message={`Il tuo ruolo non ha accesso al modulo ${vehicleLabelLower}.`}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-xl bg-[var(--brand-accent)] px-4 py-3 font-semibold text-[var(--brand-on-accent)] shadow-lg">
          {toast}
        </div>
      ) : null}

      <PageHeader
        title={`Scheda ${vehicleLabel}`}
        subtitle={`Gestione ${vehicleLabelLower}, componenti standard, documenti e stampa tecnica`}
        icon={<CarFront size={22} />}
        actions={
          canEditCars ? (
            <Button onClick={openCreate}>
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi scheda
            </Button>
          ) : undefined
        }
      />

      {!canEditCars ? (
        <div className="rounded-2xl border border-blue-400/25 bg-blue-400/10 px-4 py-3 text-sm text-blue-200">
          Hai accesso in sola lettura a questo modulo.
        </div>
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title={`Ricerca e vista ${vehicleLabel}`}
        subtitle={`La vista sintetica è pensata per consultare subito ${vehicleLabelLower} senza appesantire la pagina.`}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.035] px-4 py-3">
            <Search size={18} className="text-[var(--text-muted)]" />
            <input
              className="w-full bg-transparent text-[var(--text-primary)] outline-none placeholder:text-white/30"
              placeholder={`Cerca nome ${vehicleLabelLower} o telaio`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex justify-start lg:justify-end">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </SectionCard>

      {loading ? (
        <div className="text-[var(--text-secondary)]"><LocalizedText text="Caricamento schede..." /></div>
      ) : filteredCars.length === 0 ? (
        <EmptyState
          title={tr("Nessun elemento registrato")}
          description="Crea la prima scheda o modifica le definizioni in impostazioni."
        />
      ) : viewMode === "compact" ? (
        <SectionCard
          title={`Elenco ${vehicleLabel}`}
          subtitle="Vista sintetica di default: righe compatte, stato e azioni principali sempre visibili."
        >
          <div className="space-y-3">
            {filteredCars.map((car) => {
              const criticalCount = car.components.filter(
                (component) => getComponentStatus(component).label !== "OK",
              ).length;
              return (
                <div key={car.id} className="data-row">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr_0.55fr_0.55fr_0.6fr_auto] xl:items-center">
                    <div>
                      <div className="font-extrabold uppercase tracking-[0.03em] text-[var(--text-primary)]">
                        {car.name}
                      </div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">
                        Telaio {car.chassis_number || "—"}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 xl:col-span-3">
                      <MiniStat label="Ore" value={formatComponentHours(car.hours)} />
                      <MiniStat label="Componenti" value={String(car.components.length)} />
                      <MiniStat label="Critici" value={String(criticalCount)} />
                    </div>
                    <div className="flex xl:justify-center">
                      <StatusBadge
                        label={criticalCount > 0 ? "Da controllare" : "Pronto"}
                        tone={criticalCount > 0 ? "yellow" : "green"}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <Link href={`/cars/${car.id}`} className="race-action-secondary px-3 py-2 text-sm">
                        <LocalizedText text="Apri" />
                      </Link>
                      {canEditCars ? (
                        <button onClick={() => openEdit(car)} className="race-action-secondary px-3 py-2 text-sm">
                          <Edit size={15} className="mr-1 inline" />
                          <LocalizedText text="Modifica" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredCars.map((car) => (
            <SectionCard
              key={car.id}
              title={car.name}
              subtitle={`Telaio ${car.chassis_number || "—"}`}
            >
              <div className="mb-4">
                <img
                  src={car.image_url || "/mia-foto.png"}
                  alt={vehicleLabel}
                  className="h-40 w-full rounded-2xl object-cover"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <MiniStat label="Ore" value={formatComponentHours(car.hours)} />
                <MiniStat
                  label="Componenti"
                  value={String(car.components.length)}
                />
                <MiniStat
                  label="Critici"
                  value={String(
                    car.components.filter(
                      (component) =>
                        getComponentStatus(component).label !== "OK",
                    ).length,
                  )}
                />
              </div>
              <div className="mt-4 space-y-3">
                {car.components.length === 0 ? (
                  <EmptyState
                    title={tr("Nessun componente associato")}
                    description="Completa la configurazione del mezzo dal form di modifica."
                  />
                ) : (
                  car.components.map((component) => {
                    const status = getComponentStatus(component);
                    return (
                      <div key={component.id} className="data-row">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-extrabold text-[var(--text-primary)]">
                              {component.type} · {component.identifier}
                            </div>
                            <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                              Ore rev. {formatComponentHours(component.hours)} /
                              vita acc.{" "}
                              {formatComponentHours(component.life_hours)}
                            </div>
                          </div>
                          <StatusBadge
                            label={status.label}
                            tone={status.tone}
                          />
                        </div>
                        <div className="mt-3">
                          <Link
                            href={`/components/${component.id}`}
                            className="race-action-secondary px-4 py-2 text-sm"
                          >
                            Apri componente
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {canEditCars ? (
                  <button
                    onClick={() => openEdit(car)}
                    className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-semibold text-[var(--brand-on-accent)] hover:brightness-95"
                  >
                    <Edit size={16} className="mr-2 inline" />
                    <LocalizedText text="Modifica" />
                  </button>
                ) : null}
                <Link
                  href={`/cars/${car.id}`}
                  className="race-action-secondary px-4 py-2 text-sm"
                >
                  <LocalizedText text="Apri scheda" />
                </Link>
                <Link
                  href={`/cars/${car.id}/documents`}
                  className="race-action-secondary px-4 py-2 text-sm"
                >
                  <FileText size={16} className="mr-2 inline" />
                  <LocalizedText text="Documenti" />
                </Link>
                <Link
                  href={`/cars/${car.id}/print`}
                  className="race-action-secondary px-4 py-2 text-sm"
                >
                  <Printer size={16} className="mr-2 inline" />
                  <LocalizedText text="Stampa" />
                </Link>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="modal-panel dark-scrollbar max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl p-6">
            <PageHeader
              title={editing ? `Modifica ${editing.name}` : "Nuova scheda"}
              subtitle={`Crea o aggiorna la scheda e associa i componenti definiti dal template del team`}
            />
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
              <SectionCard title={`Identità scheda`}>
                <div className="space-y-4">
                  <Field label="Nome" required>
                    <input
                      className="form-control-dark"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field label="Numero telaio" required>
                    <input
                      className="form-control-dark"
                      value={chassis}
                      onChange={(e) => setChassis(e.target.value)}
                    />
                  </Field>
                  <Field label="Note tecniche">
                    <textarea
                      className="form-control-dark min-h-32"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                  <Field label="Immagine scheda">
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
                        <img
                          src={imageUrl || "/mia-foto.png"}
                          alt="Anteprima immagine scheda"
                          className="h-32 w-full object-cover"
                        />
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="form-control-dark"
                        disabled={uploadingImage}
                        onChange={(event) => void handleCarImageUpload(event.target.files?.[0])}
                      />
                      <div className="text-xs leading-5 text-[var(--text-secondary)]">
                        {tr("Puoi sostituire l'immagine mostrata nelle schede. Formati immagine, massimo 3 MB.")}
                      </div>
                      {imageUrl ? (
                        <button
                          type="button"
                          className="race-action-secondary px-3 py-2 text-xs"
                          onClick={() => setImageUrl("")}
                        >
                          {tr("Rimuovi immagine personalizzata")}
                        </button>
                      ) : null}
                    </div>
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                title={tr("Configurazione componenti")}
                subtitle={tr("Le etichette sono state rese più chiare: ogni campo spiega esattamente cosa inserire.")}
              >
                <div className="race-info-box mb-5 text-sm">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <div className="font-bold"><LocalizedText text="Come leggere i campi" /></div>
                      <ul className="list-disc space-y-1 pl-5">
                        <li>{tr("Ore da ultima revisione: ore accumulate dall’ultima revisione/reset. Per un componente nuovo puoi lasciare 0.")}</li>
                        <li>{tr("Ore vita accumulate: storico totale del componente, non si azzera con le revisioni.")}</li>
                        <li>{tr("Soglia attenzione: ore da cui il sistema deve segnalare il componente come da monitorare.")}</li>
                        <li>{tr("Soglia revisione: ore massime prima di revisione o fermo tecnico.")}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  {definitions.map((def) => {
                    const form =
                      componentForms[def.code] ||
                      defaultComponentForm(def.default_expiry_years);
                    const options = availableOptions(def.code, editing?.id);
                    const categoryCopy = getDefinitionCategoryCopy(def);

                    return (
                      <div key={def.id} className="data-row">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-extrabold text-[var(--text-primary)]">
                              {def.label}
                            </div>
                            <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                              {categoryCopy.description}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge
                              label={categoryCopy.label}
                              tone={categoryCopy.tone}
                            />
                            {def.is_required ? (
                              <StatusBadge label="Obbligatorio" tone="blue" />
                            ) : (
                              <StatusBadge label="Opzionale" tone="neutral" />
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
                          <Field label="Azione sul componente">
                            <select
                              className="form-control-dark min-w-0"
                              value={form.mode}
                              onChange={(e) =>
                                setComponentForms((prev) => ({
                                  ...prev,
                                  [def.code]: {
                                    ...form,
                                    mode: e.target.value as "existing" | "new",
                                  },
                                }))
                              }
                            >
                              <option value="existing">{tr("Seleziona componente esistente")}</option>
                              <option value="new">{tr("Crea nuovo componente")}</option>
                            </select>
                          </Field>

                          {form.mode === "existing" ? (
                            <Field label="Componente disponibile">
                              <select
                                className="form-control-dark min-w-0"
                                value={form.existingId}
                                onChange={(e) =>
                                  setComponentForms((prev) => ({
                                    ...prev,
                                    [def.code]: {
                                      ...form,
                                      existingId: e.target.value,
                                    },
                                  }))
                                }
                              >
                                <option value="">{tr("Seleziona componente disponibile")}</option>
                                {options.map((component) => (
                                  <option
                                    key={component.id}
                                    value={component.id}
                                  >
                                    {component.identifier}
                                    {component.car_id
                                      ? ` · ${tr("già su")} ${normalizeCarName(component.car) || tr("mezzo")}`
                                      : ` · ${tr("smontato / disponibile")}`}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          ) : (
                            <div className="min-w-0 grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                              <Field label="Identificativo componente" required>
                                <input
                                  className="form-control-dark min-w-0"
                                  value={form.identifier}
                                  onChange={(e) =>
                                    setComponentForms((prev) => ({
                                      ...prev,
                                      [def.code]: {
                                        ...form,
                                        identifier: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </Field>

                              <Field label="Ore da ultima revisione">
                                <input
                                  className="form-control-dark min-w-0"
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={form.hours}
                                  onChange={(e) =>
                                    setComponentForms((prev) => ({
                                      ...prev,
                                      [def.code]: {
                                        ...form,
                                        hours: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </Field>

                              <Field label="Ore vita accumulate">
                                <input
                                  className="form-control-dark min-w-0"
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={form.life_hours}
                                  onChange={(e) =>
                                    setComponentForms((prev) => ({
                                      ...prev,
                                      [def.code]: {
                                        ...form,
                                        life_hours: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </Field>

                              <Field label="Soglia attenzione">
                                <input
                                  className="form-control-dark min-w-0"
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={form.warning_threshold_hours}
                                  onChange={(e) =>
                                    setComponentForms((prev) => ({
                                      ...prev,
                                      [def.code]: {
                                        ...form,
                                        warning_threshold_hours: e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </Field>

                              <Field label="Soglia revisione">
                                <input
                                  className="form-control-dark min-w-0"
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={form.revision_threshold_hours}
                                  onChange={(e) =>
                                    setComponentForms((prev) => ({
                                      ...prev,
                                      [def.code]: {
                                        ...form,
                                        revision_threshold_hours:
                                          e.target.value,
                                      },
                                    }))
                                  }
                                />
                              </Field>

                              {def.has_expiry ? (
                                <Field label="Scadenza">
                                  <input
                                    className="form-control-dark min-w-0"
                                    type="date"
                                    value={form.expiry_date}
                                    onChange={(e) =>
                                      setComponentForms((prev) => ({
                                        ...prev,
                                        [def.code]: {
                                          ...form,
                                          expiry_date: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </Field>
                              ) : (
                                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-4 text-sm text-[var(--text-secondary)]">
                                  Questo tipo non richiede una scadenza a
                                  calendario.
                                </div>
                              )}

                              <div className="xl:col-span-2 2xl:col-span-3 min-w-0">
                                <Field label="Note componente">
                                  <textarea
                                    className="form-control-dark min-h-24"
                                    value={form.notes}
                                    onChange={(e) =>
                                      setComponentForms((prev) => ({
                                        ...prev,
                                        [def.code]: {
                                          ...form,
                                          notes: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </Field>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="race-action-secondary px-4 py-2 text-sm"
              >
                <LocalizedText text="Annulla" />
              </button>
              <button
                onClick={saveCar}
                disabled={saving}
                className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 font-bold text-[var(--brand-on-accent)] hover:brightness-95"
              >
                {saving
                  ? "Salvataggio..."
                  : editing
                    ? "Salva modifiche"
                    : "Salva scheda"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-sm font-semibold text-[var(--text-secondary)]">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function FieldHint({ children: _children }: { children: React.ReactNode }) {
  return null;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="race-mini-panel">
      <div className="text-sm text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-lg font-bold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}
