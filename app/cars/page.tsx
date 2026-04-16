"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Audiowide } from "next/font/google";
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
import { getCurrentTeamContext } from "@/lib/teamContext";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import PagePermissionState from "@/components/PagePermissionState";
import { usePermissionAccess } from "@/lib/permissions";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type CarRow = {
  id: string;
  name: string;
  chassis_number: string | null;
  hours: number | null;
  notes: string | null;
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
  const access = usePermissionAccess();
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
  const [componentForms, setComponentForms] = useState<Record<string, ComponentForm>>({});
  const [toast, setToast] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [carsRes, defsRes, compsRes] = await Promise.all([
        supabase
          .from("cars")
          .select(
            `id,name,chassis_number,hours,notes,components(id,type,identifier,expiry_date,hours,life_hours,warning_threshold_hours,revision_threshold_hours)`
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
        })) as CarRow[]
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
      { label: "Mezzi", value: String(cars.length), icon: <CarFront size={18} /> },
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
                (component) => getComponentStatus(component).label !== "OK"
              ).length,
            0
          )
        ),
        icon: <Search size={18} />,
      },
    ],
    [cars, definitions.length, allComponents.length]
  );

  const filteredCars = useMemo(() => {
    if (!search.trim()) return cars;
    const q = search.toLowerCase();
    return cars.filter(
      (car) =>
        car.name.toLowerCase().includes(q) ||
        (car.chassis_number || "").toLowerCase().includes(q)
    );
  }, [cars, search]);

  function openCreate() {
    if (!canEditCars) return;
    setEditing(null);
    setName("");
    setChassis("");
    setNotes("");
    setComponentForms(
      Object.fromEntries(
        definitions.map((def) => [def.code, defaultComponentForm(def.default_expiry_years)])
      )
    );
    setOpen(true);
  }

  function openEdit(car: CarRow) {
    if (!canEditCars) return;
    const next: Record<string, ComponentForm> = {};
    for (const def of definitions) {
      const existing = car.components.find((component) => component.type === def.code);
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
    setComponentForms(next);
    setOpen(true);
  }

  function availableOptions(type: string, currentCarId?: string) {
    return allComponents.filter(
      (component) =>
        component.type === type && (!component.car_id || component.car_id === currentCarId)
    );
  }

  async function createOrAttachComponents(carId: string) {
    const ctx = await getCurrentTeamContext();
    for (const def of definitions) {
      const form = componentForms[def.code];
      if (!form) continue;

      if (form.mode === "existing" && form.existingId) {
        const { error } = await supabase
          .from("components")
          .update({ car_id: carId })
          .eq("team_id", ctx.teamId)
          .eq("id", form.existingId);
        if (error) throw error;
      }

      if (form.mode === "new" && form.identifier.trim()) {
        const payload: any = {
          team_id: ctx.teamId,
          type: def.code,
          identifier: form.identifier.trim(),
          car_id: carId,
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
        const { error } = await supabase.from("components").insert([payload]);
        if (error) throw error;
      }

      if (!def.is_required && !form.existingId && !form.identifier.trim()) continue;
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
            },
          ])
          .select("id")
          .single();
        if (error) throw error;
        carId = data.id;
      }
      await createOrAttachComponents(carId!);
      setOpen(false);
      setToast(editing ? "Auto aggiornata" : "Auto creata");
      setTimeout(() => setToast(""), 2500);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Errore salvataggio auto");
    } finally {
      setSaving(false);
    }
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Auto"
        subtitle="Anagrafica mezzi e configurazione componenti"
        icon={<CarFront size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Auto"
        subtitle="Anagrafica mezzi e configurazione componenti"
        icon={<CarFront size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewCars) {
    return (
      <PagePermissionState
        title="Auto"
        subtitle="Anagrafica mezzi e configurazione componenti"
        icon={<CarFront size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo auto."
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6 ${audiowide.className}`}>
      {toast ? (
        <div className="fixed right-6 top-6 z-50 rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-black shadow-lg">
          {toast}
        </div>
      ) : null}

      <PageHeader
        title="Scheda Mezzi"
        subtitle="Gestione mezzo, componenti standard, documenti e stampa tecnica"
        icon={<CarFront size={22} />}
        actions={
          canEditCars ? (
            <button
              onClick={openCreate}
              className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Aggiungi mezzo
            </button>
          ) : undefined
        }
      />

      {!canEditCars ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hai accesso in sola lettura a questo modulo.
        </div>
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard title="Ricerca mezzi" subtitle="Filtro rapido per nome o telaio">
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <Search size={18} className="text-neutral-400" />
          <input
            className="w-full bg-transparent outline-none"
            placeholder="Cerca nome mezzo o telaio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </SectionCard>

      {loading ? (
        <div className="text-neutral-500">Caricamento mezzi...</div>
      ) : filteredCars.length === 0 ? (
        <EmptyState
          title="Nessun mezzo registrato"
          description="Crea il primo mezzo o modifica le definizioni in impostazioni."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {filteredCars.map((car) => (
            <SectionCard
              key={car.id}
              title={car.name}
              subtitle={`Telaio ${car.chassis_number || "—"}`}
            >
              <div className="mb-4">
                <Image
                  src="/mia-foto.png"
                  alt="Mezzo"
                  width={1200}
                  height={500}
                  className="h-40 w-full rounded-2xl object-cover"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <MiniStat label="Ore" value={`${Number(car.hours || 0).toFixed(1)} h`} />
                <MiniStat label="Componenti" value={String(car.components.length)} />
                <MiniStat
                  label="Critici"
                  value={String(
                    car.components.filter(
                      (component) => getComponentStatus(component).label !== "OK"
                    ).length
                  )}
                />
              </div>
              <div className="mt-4 space-y-3">
                {car.components.length === 0 ? (
                  <EmptyState
                    title="Nessun componente associato"
                    description="Completa la configurazione del mezzo dal form di modifica."
                  />
                ) : (
                  car.components.map((component) => {
                    const status = getComponentStatus(component);
                    return (
                      <div
                        key={component.id}
                        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-neutral-900">
                              {component.type} · {component.identifier}
                            </div>
                            <div className="mt-1 text-sm text-neutral-500">
                              Ore {Number(component.hours || 0).toFixed(1)} / vita{" "}
                              {Number(component.life_hours || 0).toFixed(1)}
                            </div>
                          </div>
                          <StatusBadge label={status.label} tone={status.tone} />
                        </div>
                        <div className="mt-3">
                          <Link
                            href={`/components/${component.id}`}
                            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100"
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
                    className="rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-500"
                  >
                    <Edit size={16} className="mr-2 inline" />
                    Modifica
                  </button>
                ) : null}
                <Link href={`/cars/${car.id}`} className="rounded-xl border px-4 py-2 font-semibold">
                  Apri scheda
                </Link>
                <Link
                  href={`/cars/${car.id}/documents`}
                  className="rounded-xl border px-4 py-2 font-semibold"
                >
                  <FileText size={16} className="mr-2 inline" />
                  Documenti
                </Link>
                <Link
                  href={`/cars/${car.id}/print`}
                  className="rounded-xl border px-4 py-2 font-semibold"
                >
                  <Printer size={16} className="mr-2 inline" />
                  Stampa
                </Link>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <PageHeader
              title={editing ? `Modifica ${editing.name}` : "Nuovo mezzo"}
              subtitle="Crea o aggiorna il mezzo e associa i componenti definiti dal template del team"
            />
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
              <SectionCard title="Identità mezzo">
                <div className="space-y-4">
                  <Field label="Nome mezzo" required>
                    <input
                      className="w-full rounded-xl border p-3"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field label="Numero telaio" required>
                    <input
                      className="w-full rounded-xl border p-3"
                      value={chassis}
                      onChange={(e) => setChassis(e.target.value)}
                    />
                  </Field>
                  <Field label="Note tecniche">
                    <textarea
                      className="min-h-32 w-full rounded-xl border p-3"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard
                title="Configurazione componenti"
                subtitle="Le etichette sono state rese più chiare: ogni campo spiega esattamente cosa inserire."
              >
                <div className="mb-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <div className="font-bold">Come leggere i campi</div>
                      <ul className="list-disc space-y-1 pl-5">
                        <li>
                          <strong>Ore attuali</strong>: ore già maturate dal componente.
                          Per un componente nuovo puoi lasciare 0.
                        </li>
                        <li>
                          <strong>Vita totale</strong>: vita utile prevista prima della sostituzione.
                        </li>
                        <li>
                          <strong>Soglia attenzione</strong>: ore da cui il sistema deve segnalare
                          il componente come da monitorare.
                        </li>
                        <li>
                          <strong>Soglia revisione</strong>: ore massime prima di revisione o
                          fermo tecnico.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

<div className="space-y-5">
  {definitions.map((def) => {
    const form =
      componentForms[def.code] || defaultComponentForm(def.default_expiry_years);
    const options = availableOptions(def.code, editing?.id);
    const categoryCopy = getDefinitionCategoryCopy(def);

    return (
      <div
        key={def.id}
        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-neutral-900">{def.label}</div>
            <div className="mt-1 text-sm text-neutral-500">
              {categoryCopy.description}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge label={categoryCopy.label} tone={categoryCopy.tone} />
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
              className="w-full min-w-0 rounded-xl border p-3"
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
              <option value="existing">Seleziona componente esistente</option>
              <option value="new">Crea nuovo componente</option>
            </select>
          </Field>

          {form.mode === "existing" ? (
            <Field label="Componente disponibile">
              <select
                className="w-full min-w-0 rounded-xl border p-3"
                value={form.existingId}
                onChange={(e) =>
                  setComponentForms((prev) => ({
                    ...prev,
                    [def.code]: { ...form, existingId: e.target.value },
                  }))
                }
              >
                <option value="">Seleziona componente disponibile</option>
                {options.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.identifier}
                    {component.car_id
                      ? ` · già su ${normalizeCarName(component.car) || "mezzo"}`
                      : " · smontato / disponibile"}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="min-w-0 grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              <Field label="Identificativo componente" required>
                <input
                  className="w-full min-w-0 rounded-xl border p-3"
                  value={form.identifier}
                  onChange={(e) =>
                    setComponentForms((prev) => ({
                      ...prev,
                      [def.code]: { ...form, identifier: e.target.value },
                    }))
                  }
                />
              </Field>

              <Field label="Ore attuali">
                <input
                  className="w-full min-w-0 rounded-xl border p-3"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.hours}
                  onChange={(e) =>
                    setComponentForms((prev) => ({
                      ...prev,
                      [def.code]: { ...form, hours: e.target.value },
                    }))
                  }
                />
              </Field>

              <Field label="Vita totale prevista">
                <input
                  className="w-full min-w-0 rounded-xl border p-3"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.life_hours}
                  onChange={(e) =>
                    setComponentForms((prev) => ({
                      ...prev,
                      [def.code]: { ...form, life_hours: e.target.value },
                    }))
                  }
                />
              </Field>

              <Field label="Soglia attenzione">
                <input
                  className="w-full min-w-0 rounded-xl border p-3"
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
                  className="w-full min-w-0 rounded-xl border p-3"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.revision_threshold_hours}
                  onChange={(e) =>
                    setComponentForms((prev) => ({
                      ...prev,
                      [def.code]: {
                        ...form,
                        revision_threshold_hours: e.target.value,
                      },
                    }))
                  }
                />
              </Field>

              {def.has_expiry ? (
                <Field label="Scadenza">
                  <input
                    className="w-full min-w-0 rounded-xl border p-3"
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) =>
                      setComponentForms((prev) => ({
                        ...prev,
                        [def.code]: { ...form, expiry_date: e.target.value },
                      }))
                    }
                  />
                </Field>
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
                  Questo tipo non richiede una scadenza a calendario.
                </div>
              )}

              <div className="xl:col-span-2 2xl:col-span-3 min-w-0">
                <Field label="Note componente">
                  <textarea
                    className="min-h-24 w-full rounded-xl border p-3"
                    value={form.notes}
                    onChange={(e) =>
                      setComponentForms((prev) => ({
                        ...prev,
                        [def.code]: { ...form, notes: e.target.value },
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
                className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold"
              >
                Annulla
              </button>
              <button
                onClick={saveCar}
                disabled={saving}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
              >
                {saving ? "Salvataggio..." : editing ? "Salva modifiche" : "Crea mezzo"}
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
      <label className="mb-1 block text-sm font-semibold text-neutral-700">
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
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-neutral-900">{value}</div>
    </div>
  );
}