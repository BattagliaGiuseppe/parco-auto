"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Filter,
  Gauge,
  PlusCircle,
  RotateCcw,
  Search,
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
import { formatComponentHours, getComponentHoursInfo, getComponentStatus } from "@/lib/componentStatus";

type CarOption = { id: string; name: string };

type Definition = {
  code: string;
  label: string;
  category?: string | null;
  is_required?: boolean | null;
  tracks_hours?: boolean | null;
  has_expiry?: boolean | null;
  default_expiry_years?: number | null;
  order_index?: number | null;
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
  notes: string | null;
  car_id: string | null;
  car: { name: string } | { name: string }[] | null;
};

const emptyForm = {
  type: "",
  customType: "",
  identifier: "",
  car_id: "",
  hours: "0",
  life_hours: "0",
  warning_threshold_hours: "",
  revision_threshold_hours: "",
  expiry_date: "",
  notes: "",
};

function normalizeCarName(car: ComponentRow["car"]) {
  if (!car) return null;
  if (Array.isArray(car)) return car[0]?.name || null;
  return car.name || null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("it-IT");
}

const getStatus = getComponentStatus;
const getHoursInfo = getComponentHoursInfo;
const formatHours = formatComponentHours;

function ProgressBar({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <div className="h-2 rounded-full bg-neutral-100">
        <div className="h-2 w-0 rounded-full bg-neutral-300" />
      </div>
    );
  }

  return (
    <div className="h-2 rounded-full bg-neutral-100">
      <div
        className="h-2 rounded-full bg-yellow-400"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function ComponentsPage() {
  const access = usePermissionAccess();
  const canViewComponents = access.hasPermission("components.view");
  const canEditComponents = access.hasPermission("components.edit", ["owner", "admin"]);

  const [rows, setRows] = useState<ComponentRow[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "mounted" | "unmounted" | "attention" | "revision">("all");
  const [carFilter, setCarFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  async function loadAll() {
    setLoading(true);
    try {
      const ctx = await getCurrentTeamContext();
      const [rowsRes, carsRes, defsRes] = await Promise.all([
        supabase
          .from("components")
          .select(
            "id,type,identifier,expiry_date,hours,life_hours,warning_threshold_hours,revision_threshold_hours,notes,car_id,car:car_id(name)"
          )
          .eq("team_id", ctx.teamId)
          .order("identifier", { ascending: true }),
        supabase.from("cars").select("id,name").eq("team_id", ctx.teamId).order("name", { ascending: true }),
        supabase
          .from("team_component_definitions")
          .select("*")
          .eq("team_id", ctx.teamId)
          .order("order_index", { ascending: true }),
      ]);

      if (rowsRes.error) throw rowsRes.error;
      if (carsRes.error) throw carsRes.error;
      if (defsRes.error) throw defsRes.error;

      setRows((rowsRes.data || []) as ComponentRow[]);
      setCars((carsRes.data || []) as CarOption[]);
      setDefinitions((defsRes.data || []) as Definition[]);
    } catch (error) {
      console.error("Errore caricamento componenti:", error);
      alert("Errore nel caricamento dei componenti");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && canViewComponents) {
      void loadAll();
    }
  }, [access.loading, canViewComponents]);

  const availableTypes = useMemo(() => {
    const fromDefinitions = definitions.map((definition) => ({
      value: definition.code,
      label: definition.label,
    }));
    const fromRows = [...new Set(rows.map((row) => row.type))]
      .filter((value) => !fromDefinitions.some((definition) => definition.value === value))
      .map((value) => ({ value, label: value }));
    return [...fromDefinitions, ...fromRows];
  }, [definitions, rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const carName = normalizeCarName(row.car) || "";
      const q = search.trim().toLowerCase();
      const status = getStatus(row);

      if (statusFilter === "mounted" && !row.car_id) return false;
      if (statusFilter === "unmounted" && row.car_id) return false;
      if (statusFilter === "attention" && status.label !== "Attenzione") return false;
      if (statusFilter === "revision" && status.label !== "Revisione necessaria") return false;
      if (carFilter && row.car_id !== carFilter) return false;
      if (typeFilter && row.type !== typeFilter) return false;
      if (q && !`${row.identifier} ${row.type} ${carName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, carFilter, typeFilter, search]);

  const stats = useMemo(() => {
    const statuses = rows.map((row) => getStatus(row));
    const revisionCount = statuses.filter((status) => status.label === "Revisione necessaria" || status.label === "Scaduto").length;
    const attentionCount = statuses.filter((status) => status.label === "Attenzione").length;

    return [
      {
        label: "Totale componenti",
        value: String(rows.length),
        icon: <Boxes size={18} />,
      },
      {
        label: "Montati",
        value: String(rows.filter((row) => !!row.car_id).length),
        icon: <CheckCircle2 size={18} />,
      },
      {
        label: "In attenzione",
        value: String(attentionCount),
        icon: <AlertTriangle size={18} />,
      },
      {
        label: "Da revisionare",
        value: String(revisionCount),
        icon: <RotateCcw size={18} />,
      },
    ];
  }, [rows]);

  async function saveComponent() {
    if (!canEditComponents) return;

    const type = form.type === "__custom__" ? form.customType.trim() : form.type;
    if (!type || !form.identifier.trim()) {
      alert("Tipo e identificativo sono obbligatori");
      return;
    }

    setSaving(true);
    try {
      const ctx = await getCurrentTeamContext();
      const selectedCarId = form.car_id || null;
      const payload = {
        team_id: ctx.teamId,
        type,
        identifier: form.identifier.trim(),
        // Il componente nasce sempre libero: il montaggio passa dalla RPC
        // per creare anche lo storico e chiudere eventuali componenti dello stesso tipo.
        car_id: null,
        hours: Number(form.hours || 0),
        life_hours: Number(form.life_hours || 0),
        warning_threshold_hours: form.warning_threshold_hours
          ? Number(form.warning_threshold_hours)
          : null,
        revision_threshold_hours: form.revision_threshold_hours
          ? Number(form.revision_threshold_hours)
          : null,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
        is_active: true,
      };

      if (form.type === "__custom__") {
        const existingDefinition = definitions.find((definition) => definition.code === type);
        if (!existingDefinition) {
          const { error: definitionError } = await supabase
            .from("team_component_definitions")
            .insert([
              {
                team_id: ctx.teamId,
                code: type,
                label: type,
                category: form.expiry_date ? "expiry" : "optional",
                is_required: false,
                tracks_hours: true,
                has_expiry: !!form.expiry_date,
                default_expiry_years: form.expiry_date ? 1 : null,
                order_index: definitions.length + 1,
              },
            ]);
          if (definitionError) throw definitionError;
        }
      }

      const { data, error } = await supabase
        .from("components")
        .insert([payload])
        .select("id")
        .single();
      if (error) throw error;

      if (selectedCarId) {
        const { error: mountError } = await supabase.rpc("mount_component_on_car", {
          p_team_id: ctx.teamId,
          p_car_id: selectedCarId,
          p_component_id: data.id,
          p_mounted_at: new Date().toISOString().slice(0, 10),
          p_mounted_by_team_user_id: ctx.teamUserId,
          p_reason: "Montaggio iniziale da anagrafica componente",
          p_replace_same_type: true,
        });

        if (mountError) throw mountError;
      }

      setOpen(false);
      setForm(emptyForm);
      await loadAll();
    } catch (error) {
      console.error(error);
      alert("Errore salvataggio componente");
    } finally {
      setSaving(false);
    }
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Componenti"
        subtitle="Parco componenti, ore da revisione e soglie operative"
        icon={<Boxes size={22} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Componenti"
        subtitle="Parco componenti, ore da revisione e soglie operative"
        icon={<Boxes size={22} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!canViewComponents) {
    return (
      <PagePermissionState
        title="Componenti"
        subtitle="Parco componenti, ore da revisione e soglie operative"
        icon={<Boxes size={22} />}
        state="denied"
        message="Il tuo ruolo non ha accesso al modulo componenti."
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title="Componenti"
        subtitle="Controlla ore da ultima revisione, ore vita totali e soglie operative."
        icon={<Boxes size={22} />}
        actions={
          canEditComponents ? (
            <button
              onClick={() => {
                setOpen(true);
                setForm(emptyForm);
              }}
              className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500"
            >
              <PlusCircle size={16} className="mr-2 inline" />
              Nuovo componente
            </button>
          ) : undefined
        }
      />

      {!canEditComponents ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hai accesso in sola lettura a questo modulo.
        </div>
      ) : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title="Lettura ore componenti"
        subtitle="Le ore da ultima revisione possono essere azzerate con una revisione; le ore vita totali non vengono mai azzerate."
      >
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="font-bold text-neutral-900">Ore da revisione</div>
            <div className="mt-1 text-neutral-600">
              Sono le ore accumulate dall’ultima revisione/reset e guidano warning e soglia revisione.
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="font-bold text-neutral-900">Ore vita accumulate</div>
            <div className="mt-1 text-neutral-600">
              Sono lo storico totale del componente: aumentano con i turni e non vengono azzerate dalle revisioni.
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="font-bold text-neutral-900">Ore residue</div>
            <div className="mt-1 text-neutral-600">
              Indicano quanto manca alla revisione in base alla soglia configurata.
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Filtri"
        subtitle="Trova rapidamente i componenti montati, in attenzione o da revisionare."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search size={17} className="absolute left-3 top-3.5 text-neutral-400" />
            <input
              className="w-full rounded-xl border border-neutral-200 py-3 pl-10 pr-3 text-sm"
              placeholder="Cerca per codice, tipo o auto"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative">
            <Filter size={17} className="absolute left-3 top-3.5 text-neutral-400" />
            <select
              className="w-full rounded-xl border border-neutral-200 py-3 pl-10 pr-3 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">Tutti</option>
              <option value="mounted">Montati</option>
              <option value="unmounted">Smontati</option>
              <option value="attention">In attenzione</option>
              <option value="revision">Da revisionare</option>
            </select>
          </div>

          <select
            className="w-full rounded-xl border border-neutral-200 p-3 text-sm"
            value={carFilter}
            onChange={(e) => setCarFilter(e.target.value)}
          >
            <option value="">Tutte le auto</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.name}
              </option>
            ))}
          </select>

          <select
            className="w-full rounded-xl border border-neutral-200 p-3 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Tutti i tipi</option>
            {availableTypes.map((definition) => (
              <option key={definition.value} value={definition.value}>
                {definition.label}
              </option>
            ))}
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Elenco componenti">
        {loading ? (
          <div className="text-neutral-500">Caricamento componenti...</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Nessun componente trovato" />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filtered.map((row) => {
              const status = getStatus(row);
              const info = getHoursInfo(row);
              const carName = normalizeCarName(row.car);

              return (
                <div
                  key={row.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-neutral-900">
                        {row.type} · {row.identifier}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {carName || "Non montato"}
                      </div>
                    </div>
                    <StatusBadge label={status.label} tone={status.tone} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <InfoMini
                      label="Da revisione"
                      value={formatHours(info.revisionHours)}
                    />
                    <InfoMini label="Ore vita accumulate" value={formatHours(info.lifeHours)} />
                    <InfoMini
                      label="Soglia revisione"
                      value={formatHours(info.revisionThreshold)}
                    />
                    <InfoMini
                      label="Ore residue"
                      value={
                        info.remainingHours === null ? "—" : formatHours(info.remainingHours)
                      }
                    />
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                      <span>Avanzamento verso revisione</span>
                      <span>{info.progress === null ? "Soglia non impostata" : `${info.progress.toFixed(0)}%`}</span>
                    </div>
                    <ProgressBar value={info.progress} />
                    {info.warningThreshold !== null || info.revisionThreshold !== null ? (
                      <div className="mt-2 text-xs text-neutral-500">
                        Warning: {formatHours(info.warningThreshold)} · Revisione: {formatHours(info.revisionThreshold)}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <InfoMini label="Scadenza" value={formatDate(row.expiry_date)} />
                    <InfoMini label="Stato montaggio" value={row.car_id ? "Montato" : "Smontato"} />
                  </div>

                  {row.notes ? (
                    <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
                      {row.notes}
                    </div>
                  ) : null}

                  <div className="mt-4 flex justify-end">
                    <Link
                      href={`/components/${row.id}`}
                      className="rounded-xl bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-200"
                    >
                      <Gauge size={16} className="mr-2 inline" />
                      Apri scheda
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Nuovo componente</h3>
                <div className="mt-1 text-sm text-neutral-500">
                  Configura ore iniziali, soglie di warning e soglia revisione.
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl bg-neutral-100 px-3 py-2 font-semibold"
              >
                Chiudi
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Tipo" required>
                <select
                  className="w-full rounded-xl border p-3"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="">Seleziona tipo</option>
                  {availableTypes.map((definition) => (
                    <option key={definition.value} value={definition.value}>
                      {definition.label}
                    </option>
                  ))}
                  <option value="__custom__">Tipo personalizzato</option>
                </select>
              </Field>

              {form.type === "__custom__" ? (
                <Field label="Tipo personalizzato" required>
                  <input
                    className="w-full rounded-xl border p-3"
                    value={form.customType}
                    onChange={(e) => setForm({ ...form, customType: e.target.value })}
                    placeholder="Es. Pompa benzina"
                  />
                </Field>
              ) : null}

              <Field label="Identificativo" required>
                <input
                  className="w-full rounded-xl border p-3"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  placeholder="Es. MOT-01, CAMBIO-A"
                />
              </Field>

              <Field label="Auto montata">
                <select
                  className="w-full rounded-xl border p-3"
                  value={form.car_id}
                  onChange={(e) => setForm({ ...form, car_id: e.target.value })}
                >
                  <option value="">Nessuno</option>
                  {cars.map((car) => (
                    <option key={car.id} value={car.id}>
                      {car.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Ore da ultima revisione">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-full rounded-xl border p-3"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                />
              </Field>

              <Field label="Ore vita accumulate">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-full rounded-xl border p-3"
                  value={form.life_hours}
                  onChange={(e) => setForm({ ...form, life_hours: e.target.value })}
                />
              </Field>

              <Field label="Soglia warning ore">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-full rounded-xl border p-3"
                  value={form.warning_threshold_hours}
                  onChange={(e) =>
                    setForm({ ...form, warning_threshold_hours: e.target.value })
                  }
                  placeholder="Es. 8"
                />
              </Field>

              <Field label="Soglia revisione ore">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-full rounded-xl border p-3"
                  value={form.revision_threshold_hours}
                  onChange={(e) =>
                    setForm({ ...form, revision_threshold_hours: e.target.value })
                  }
                  placeholder="Es. 10"
                />
              </Field>

              <Field label="Scadenza">
                <input
                  type="date"
                  className="w-full rounded-xl border p-3"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Note">
                  <textarea
                    className="min-h-[100px] w-full rounded-xl border p-3"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Note tecniche, seriale, storico o dettagli utili"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl bg-neutral-100 px-4 py-2 font-semibold"
              >
                Annulla
              </button>
              <button
                onClick={saveComponent}
                disabled={saving}
                className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500 disabled:opacity-60"
              >
                {saving ? "Salvataggio..." : "Salva componente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="mt-1 font-bold text-neutral-900">{value}</div>
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
    <div>
      <label className="mb-1 block text-sm font-semibold text-neutral-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}
