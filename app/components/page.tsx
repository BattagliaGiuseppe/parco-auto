"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Edit,
  PlusCircle,
  Search,
  Cog,
  CheckCircle,
  XCircle,
  Wrench,
  RotateCcw,
  TriangleAlert,
  Package,
  CalendarClock,
  Link2,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

const COMPONENT_TYPES = [
  "motore",
  "cambio",
  "differenziale",
  "cinture",
  "cavi",
  "estintore",
  "serbatoio",
  "passaporto",
] as const;

type ComponentType = (typeof COMPONENT_TYPES)[number] | string;

type CarOption = {
  id: string;
  name: string;
  chassis_number: string | null;
};

type ComponentCarRelation = {
  id: string;
  name: string;
};

type ComponentItem = {
  id: string;
  type: ComponentType;
  identifier: string;
  expiry_date: string | null;
  last_maintenance_date: string | null;
  hours: number | null;
  life_hours: number | null;
  warning_threshold_hours: number | null;
  revision_threshold_hours: number | null;
  car_id: ComponentCarRelation | null;
};

type MountHistoryRow = {
  id: string;
  component_id: string;
  status: string | null;
  mounted_at: string | null;
  removed_at: string | null;
  hours_used: number | null;
  car_id: { name: string } | null;
};

type RevisionItem = {
  id: string;
  component_id: string;
  date: string;
  description: string | null;
  notes: string | null;
  reset_hours: boolean;
  hours_before_reset: number | null;
  hours_after_reset: number | null;
  life_hours_at_revision: number | null;
  created_at: string;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

type ComponentFormState = {
  type: string;
  identifier: string;
  expiry_date: string;
  car_id: string;
  warning_threshold_hours: string;
  revision_threshold_hours: string;
};

type RevisionFormState = {
  date: string;
  description: string;
  notes: string;
  reset_hours: boolean;
};

const emptyComponentForm: ComponentFormState = {
  type: "",
  identifier: "",
  expiry_date: "",
  car_id: "",
  warning_threshold_hours: "",
  revision_threshold_hours: "",
};

const emptyRevisionForm: RevisionFormState = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  notes: "",
  reset_hours: false,
};

function formatHours(value: number | null | undefined) {
  const totalMinutes = Math.round(Number(value ?? 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function getExpiryColor(date: string) {
  const expiry = new Date(date);
  const now = new Date();

  if (expiry < now) return "text-red-600 font-bold";

  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  if (months > 12) return "text-green-700 font-semibold";
  if (months > 6) return "text-yellow-700 font-semibold";
  return "text-orange-600 font-semibold";
}

function getExpiryBadge(date: string) {
  const expiry = new Date(date);
  const now = new Date();

  if (expiry < now) {
    return {
      label: "Scaduto",
      className: "bg-red-100 text-red-700",
    };
  }

  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  if (months <= 6) {
    return {
      label: "In scadenza",
      className: "bg-yellow-100 text-yellow-800",
    };
  }

  return {
    label: "Valido",
    className: "bg-green-100 text-green-700",
  };
}

function getThresholdBadge(component: ComponentItem) {
  const hours = Number(component.hours ?? 0);
  const warning = component.warning_threshold_hours;
  const revision = component.revision_threshold_hours;

  if (revision !== null && revision !== undefined && hours >= revision) {
    return {
      label: "Fuori soglia revisione",
      className: "bg-red-100 text-red-700",
    };
  }

  if (warning !== null && warning !== undefined && hours >= warning) {
    return {
      label: "In attenzione",
      className: "bg-yellow-100 text-yellow-800",
    };
  }

  return {
    label: "OK",
    className: "bg-green-100 text-green-700",
  };
}

function normalizeNumberInput(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeCarRelation(value: any): ComponentCarRelation | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function normalizeHistoryCarRelation(value: any): { name: string } | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function ComponentsPage() {
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [cars, setCars] = useState<CarOption[]>([]);
  const [history, setHistory] = useState<Record<string, MountHistoryRow[]>>({});
  const [revisions, setRevisions] = useState<Record<string, RevisionItem[]>>({});
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [filterCar, setFilterCar] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [mountModalOpen, setMountModalOpen] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);

  const [editing, setEditing] = useState<ComponentItem | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<ComponentItem | null>(null);
  const [selectedCarId, setSelectedCarId] = useState("");

  const [formData, setFormData] = useState<ComponentFormState>(emptyComponentForm);
  const [revisionForm, setRevisionForm] = useState<RevisionFormState>(emptyRevisionForm);

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const resetComponentModalState = () => {
    setModalOpen(false);
    setEditing(null);
    setFormData(emptyComponentForm);
  };

  const resetMountModalState = () => {
    setMountModalOpen(false);
    setSelectedCarId("");
    setSelectedComponent(null);
  };

  const resetRevisionModalState = () => {
    setRevisionModalOpen(false);
    setSelectedComponent(null);
    setRevisionForm({
      ...emptyRevisionForm,
      date: new Date().toISOString().split("T")[0],
    });
  };

  const fetchComponents = async () => {
    try {
      setLoading(true);

      const [{ data: componentRows, error: componentError }, { data: carRows, error: carError }] =
        await Promise.all([
          supabase
            .from("components")
            .select(
              `
                id,
                type,
                identifier,
                expiry_date,
                last_maintenance_date,
                hours,
                life_hours,
                warning_threshold_hours,
                revision_threshold_hours,
                car_id (id, name)
              `
            )
            .order("identifier", { ascending: true }),
          supabase.from("cars").select("id, name, chassis_number").order("name", { ascending: true }),
        ]);

      if (componentError) throw componentError;
      if (carError) throw carError;

      const comps: ComponentItem[] = (componentRows || []).map((row: any) => ({
        id: row.id,
        type: row.type,
        identifier: row.identifier,
        expiry_date: row.expiry_date,
        last_maintenance_date: row.last_maintenance_date,
        hours: row.hours,
        life_hours: row.life_hours,
        warning_threshold_hours: row.warning_threshold_hours,
        revision_threshold_hours: row.revision_threshold_hours,
        car_id: normalizeCarRelation(row.car_id),
      }));

      const normalizedCars: CarOption[] = (carRows || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        chassis_number: row.chassis_number,
      }));

      setComponents(comps);
      setCars(normalizedCars);

      const componentIds = comps.map((comp) => comp.id);

      if (componentIds.length === 0) {
        setHistory({});
        setRevisions({});
        return;
      }

      const [
        { data: historyRows, error: historyError },
        { data: revisionRows, error: revisionError },
      ] = await Promise.all([
        supabase
          .from("car_components")
          .select("id, component_id, car_id (name), status, mounted_at, removed_at, hours_used")
          .in("component_id", componentIds)
          .order("mounted_at", { ascending: false }),
        supabase
          .from("component_revisions")
          .select("*")
          .in("component_id", componentIds)
          .order("date", { ascending: false }),
      ]);

      if (historyError) throw historyError;
      if (revisionError) throw revisionError;

      const historyMap: Record<string, MountHistoryRow[]> = {};
      for (const rawRow of historyRows || []) {
        const row: MountHistoryRow = {
          id: (rawRow as any).id,
          component_id: (rawRow as any).component_id,
          status: (rawRow as any).status,
          mounted_at: (rawRow as any).mounted_at,
          removed_at: (rawRow as any).removed_at,
          hours_used: (rawRow as any).hours_used,
          car_id: normalizeHistoryCarRelation((rawRow as any).car_id),
        };

        if (!historyMap[row.component_id]) historyMap[row.component_id] = [];
        historyMap[row.component_id].push(row);
      }

      const revisionMap: Record<string, RevisionItem[]> = {};
      for (const row of (revisionRows || []) as RevisionItem[]) {
        if (!revisionMap[row.component_id]) revisionMap[row.component_id] = [];
        revisionMap[row.component_id].push(row);
      }

      setHistory(historyMap);
      setRevisions(revisionMap);
    } catch (error: any) {
      showToast(`❌ Errore caricamento dati: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  const filteredComponents = useMemo(() => {
    return components.filter((component) => {
      if (filterCar === "unassigned") {
        if (component.car_id?.name) return false;
      } else if (filterCar && component.car_id?.name !== filterCar) {
        return false;
      }

      if (filterType && component.type !== filterType) {
        return false;
      }

      const needle = search.toLowerCase().trim();
      const matchesSearch =
        needle === "" ||
        component.type.toLowerCase().includes(needle) ||
        component.identifier.toLowerCase().includes(needle) ||
        (component.car_id?.name || "").toLowerCase().includes(needle);

      if (!matchesSearch) return false;

      if (!component.expiry_date) return true;

      const expiry = new Date(component.expiry_date);
      const now = new Date();
      const months =
        (expiry.getFullYear() - now.getFullYear()) * 12 +
        (expiry.getMonth() - now.getMonth());

      if (filter === "all") return true;
      if (filter === "expiring") return months <= 6 && expiry >= now;
      if (filter === "expired") return expiry < now;

      return true;
    });
  }, [components, filter, filterCar, filterType, search]);

  const availableCarNames = useMemo(
    () => [...new Set(components.map((component) => component.car_id?.name).filter(Boolean))],
    [components]
  );

  const totalComponents = components.length;
  const mountedCount = useMemo(
    () => components.filter((component) => Boolean(component.car_id)).length,
    [components]
  );
  const criticalCount = useMemo(
    () => components.filter((component) => getThresholdBadge(component).label !== "OK").length,
    [components]
  );
  const expiringCount = useMemo(
    () =>
      components.filter((component) => {
        if (!component.expiry_date) return false;
        const expiry = new Date(component.expiry_date);
        const now = new Date();
        const months =
          (expiry.getFullYear() - now.getFullYear()) * 12 +
          (expiry.getMonth() - now.getMonth());
        return months <= 6 && expiry >= now;
      }).length,
    [components]
  );

  const openCreateModal = () => {
    setEditing(null);
    setFormData(emptyComponentForm);
    setModalOpen(true);
  };

  const openEditModal = (component: ComponentItem) => {
    setEditing(component);
    setFormData({
      type: component.type,
      identifier: component.identifier,
      expiry_date: component.expiry_date ? String(component.expiry_date).split("T")[0] : "",
      car_id: component.car_id?.id || "",
      warning_threshold_hours:
        component.warning_threshold_hours !== null && component.warning_threshold_hours !== undefined
          ? String(component.warning_threshold_hours)
          : "",
      revision_threshold_hours:
        component.revision_threshold_hours !== null &&
        component.revision_threshold_hours !== undefined
          ? String(component.revision_threshold_hours)
          : "",
    });
    setModalOpen(true);
  };

  const openMountModal = (component: ComponentItem) => {
    setSelectedComponent(component);
    setSelectedCarId("");
    setMountModalOpen(true);
  };

  const openRevisionModal = (component: ComponentItem) => {
    setSelectedComponent(component);
    setRevisionForm({
      date: new Date().toISOString().split("T")[0],
      description: `Revisione ${component.type}`,
      notes: "",
      reset_hours: false,
    });
    setRevisionModalOpen(true);
  };

  const handleMountComponent = async () => {
    if (!selectedComponent || !selectedCarId) {
      showToast("❌ Seleziona un'auto per il montaggio", "error");
      return;
    }

    const { error } = await supabase.rpc("mount_component", {
      p_car_id: selectedCarId,
      p_component_id: selectedComponent.id,
    });

    if (error) {
      showToast(`❌ Errore montaggio: ${error.message}`, "error");
      return;
    }

    showToast("✅ Componente montato con successo", "success");
    resetMountModalState();
    await fetchComponents();
  };

  const handleUnmountComponent = async (componentId: string) => {
    const confirmed = confirm("Vuoi davvero smontare questo componente?");
    if (!confirmed) return;

    const { error } = await supabase.rpc("unmount_component", {
      p_car_component_id: componentId,
    });

    if (error) {
      showToast(`❌ Errore smontaggio: ${error.message}`, "error");
      return;
    }

    showToast("✅ Componente smontato", "success");
    await fetchComponents();
  };

  const handleSaveComponent = async (e: React.FormEvent) => {
    e.preventDefault();

    const basePayload = {
      identifier: formData.identifier.trim(),
      expiry_date: formData.expiry_date || null,
      warning_threshold_hours: normalizeNumberInput(formData.warning_threshold_hours),
      revision_threshold_hours: normalizeNumberInput(formData.revision_threshold_hours),
    };

    if (!editing) {
      const { data: inserted, error: insertError } = await supabase
        .from("components")
        .insert([
          {
            type: formData.type,
            ...basePayload,
          },
        ])
        .select()
        .single();

      if (insertError || !inserted) {
        showToast(`❌ Errore inserimento: ${insertError?.message || "sconosciuto"}`, "error");
        return;
      }

      if (formData.car_id) {
        const { error: mountError } = await supabase.rpc("mount_component", {
          p_car_id: formData.car_id,
          p_component_id: inserted.id,
        });

        if (mountError) {
          showToast(
            `⚠️ Componente creato, ma errore nel montaggio: ${mountError.message}`,
            "error"
          );
        } else {
          showToast("✅ Componente creato e montato", "success");
        }
      } else {
        showToast("✅ Componente creato (smontato)", "success");
      }

      resetComponentModalState();
      await fetchComponents();
      return;
    }

    const oldCarId = editing.car_id?.id || null;
    const newCarId = formData.car_id || null;

    if (oldCarId !== newCarId) {
      const confirmed = confirm(
        "Questo componente cambierà auto o stato di montaggio. Vuoi confermare?"
      );
      if (!confirmed) return;
    }

    const { error: updateError } = await supabase
      .from("components")
      .update(basePayload)
      .eq("id", editing.id);

    if (updateError) {
      showToast(`❌ Errore aggiornamento: ${updateError.message}`, "error");
      return;
    }

    if (oldCarId !== newCarId) {
      if (oldCarId) {
        const { error: unmountError } = await supabase.rpc("unmount_component", {
          p_car_component_id: editing.id,
        });

        if (unmountError) {
          showToast(`⚠️ Errore nello smontaggio: ${unmountError.message}`, "error");
          return;
        }
      }

      if (newCarId) {
        const { error: mountError } = await supabase.rpc("mount_component", {
          p_car_id: newCarId,
          p_component_id: editing.id,
        });

        if (mountError) {
          showToast(`⚠️ Errore nel montaggio: ${mountError.message}`, "error");
          return;
        }
      }
    }

    showToast("✅ Componente aggiornato", "success");
    resetComponentModalState();
    await fetchComponents();
  };

  const handleSaveRevision = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedComponent) {
      showToast("❌ Nessun componente selezionato", "error");
      return;
    }

    if (revisionForm.reset_hours) {
      const confirmed = confirm(
        "Questa revisione azzererà le ore attuali del componente. Vuoi continuare?"
      );
      if (!confirmed) return;
    }

    const { error } = await supabase.from("component_revisions").insert([
      {
        component_id: selectedComponent.id,
        date: revisionForm.date,
        description: revisionForm.description.trim() || null,
        notes: revisionForm.notes.trim() || null,
        reset_hours: revisionForm.reset_hours,
      },
    ]);

    if (error) {
      showToast(`❌ Errore salvataggio revisione: ${error.message}`, "error");
      return;
    }

    showToast("✅ Revisione registrata", "success");
    resetRevisionModalState();
    await fetchComponents();
  };

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <Cog size={14} />
                Gestione Componenti
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Componenti e storico tecnico
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Controlla montaggi, soglie ore, revisioni e scadenze dei componenti del parco auto.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Package size={18} className="text-yellow-600" />}
              label="Componenti totali"
              value={String(totalComponents)}
            />
            <SummaryCard
              icon={<Link2 size={18} className="text-yellow-600" />}
              label="Montati"
              value={String(mountedCount)}
            />
            <SummaryCard
              icon={<TriangleAlert size={18} className="text-yellow-600" />}
              label="Criticità"
              value={String(criticalCount)}
              valueClassName={criticalCount > 0 ? "text-red-700" : "text-green-700"}
            />
            <SummaryCard
              icon={<CalendarClock size={18} className="text-yellow-600" />}
              label="In scadenza"
              value={String(expiringCount)}
              valueClassName={expiringCount > 0 ? "text-yellow-700" : "text-green-700"}
            />
          </div>
        </div>
      </section>

      <section className="card-base p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center flex-1">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per tipo, identificativo o auto..."
                className="w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-3 py-3 text-sm"
              />
            </div>

            <select
              value={filterCar}
              onChange={(e) => setFilterCar(e.target.value)}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm"
            >
              <option value="">Tutte le auto</option>
              <option value="unassigned">Smontati</option>
              {availableCarNames.map((carName) => (
                <option key={carName} value={carName}>
                  {carName}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm"
            >
              <option value="">Tutti i tipi</option>
              {[...new Set(components.map((component) => component.type).filter(Boolean))].map(
                (type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                )
              )}
            </select>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "expiring" | "expired")}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm"
            >
              <option value="all">Tutti</option>
              <option value="expiring">In scadenza</option>
              <option value="expired">Scaduti</option>
            </select>
          </div>

          <div>
            <button onClick={openCreateModal} className="btn-primary">
              <PlusCircle size={18} /> Aggiungi componente
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="card-base p-10 text-center text-neutral-500">Caricamento...</div>
      ) : filteredComponents.length === 0 ? (
        <div className="card-base p-10 text-center text-neutral-500">
          Nessun componente trovato con i filtri attuali.
        </div>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {filteredComponents.map((component) => {
            const threshold = getThresholdBadge(component);
            const latestRevision = revisions[component.id]?.[0];
            const expiryBadge = component.expiry_date ? getExpiryBadge(component.expiry_date) : null;

            return (
              <article
                key={component.id}
                className="card-base overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="bg-black text-yellow-500 px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Wrench size={18} />
                      <h2 className="text-lg font-bold truncate">{capitalize(component.type)}</h2>
                    </div>

                    <div className="mt-1 text-sm text-yellow-100/80 truncate">
                      {component.identifier}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          component.car_id
                            ? "bg-yellow-100 text-yellow-900"
                            : "bg-neutral-700 text-neutral-100"
                        }`}
                      >
                        {component.car_id ? `Montato su ${component.car_id.name}` : "Smontato"}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => openEditModal(component)}
                      className="btn-primary !px-3 !py-2 !rounded-lg"
                    >
                      <Edit size={16} /> Modifica
                    </button>

                    <button
                      onClick={() => openRevisionModal(component)}
                      className="btn-dark !px-3 !py-2 !rounded-lg"
                    >
                      <RotateCcw size={16} /> Revisione
                    </button>
                  </div>
                </div>

                <div className="p-4 md:p-5 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${threshold.className}`}
                    >
                      {threshold.label}
                    </span>

                    {expiryBadge && (
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${expiryBadge.className}`}
                      >
                        {expiryBadge.label}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <MiniInfoCard label="Ore attuali" value={formatHours(component.hours)} />
                    <MiniInfoCard label="Ore vita totale" value={formatHours(component.life_hours)} />
                    <MiniInfoCard
                      label="Soglia attenzione"
                      value={
                        component.warning_threshold_hours !== null &&
                        component.warning_threshold_hours !== undefined
                          ? formatHours(component.warning_threshold_hours)
                          : "—"
                      }
                    />
                    <MiniInfoCard
                      label="Soglia revisione"
                      value={
                        component.revision_threshold_hours !== null &&
                        component.revision_threshold_hours !== undefined
                          ? formatHours(component.revision_threshold_hours)
                          : "—"
                      }
                    />
                  </div>

                  {component.expiry_date && (
                    <div className="text-sm">
                      <span className="text-neutral-500">Scadenza: </span>
                      <span className={getExpiryColor(component.expiry_date)}>
                        {new Date(component.expiry_date).toLocaleDateString("it-IT")}
                      </span>
                    </div>
                  )}

                  <div className="text-sm text-neutral-700">
                    <span className="font-semibold">Ultima revisione:</span>{" "}
                    {latestRevision?.date
                      ? new Date(latestRevision.date).toLocaleDateString("it-IT")
                      : "—"}
                  </div>

                  <div className="flex justify-end gap-2 flex-wrap">
                    {!component.car_id ? (
                      <button
                        onClick={() => openMountModal(component)}
                        className="btn-primary !px-3 !py-2 !rounded-lg"
                      >
                        🧩 Monta
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnmountComponent(component.id)}
                        className="btn-secondary !px-3 !py-2 !rounded-lg"
                      >
                        ❌ Smonta
                      </button>
                    )}
                  </div>

                  {revisions[component.id]?.length > 0 && (
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                      <h3 className="font-semibold text-sm mb-2 text-neutral-800">
                        Ultime revisioni
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="table-clean">
                          <thead>
                            <tr>
                              <th>Data</th>
                              <th>Reset</th>
                              <th>Ore prima</th>
                              <th>Ore dopo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {revisions[component.id].slice(0, 3).map((revision) => (
                              <tr key={revision.id}>
                                <td>{new Date(revision.date).toLocaleDateString("it-IT")}</td>
                                <td>{revision.reset_hours ? "Sì" : "No"}</td>
                                <td>
                                  {revision.hours_before_reset !== null
                                    ? formatHours(revision.hours_before_reset)
                                    : "—"}
                                </td>
                                <td>
                                  {revision.hours_after_reset !== null
                                    ? formatHours(revision.hours_after_reset)
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {history[component.id]?.length > 0 && (
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                      <h3 className="font-semibold text-sm mb-2 text-neutral-800">
                        Storico montaggi
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="table-clean">
                          <thead>
                            <tr>
                              <th>Auto</th>
                              <th>Stato</th>
                              <th>Da</th>
                              <th>A</th>
                              <th>Ore</th>
                            </tr>
                          </thead>
                          <tbody>
                            {history[component.id].map((row) => (
                              <tr key={row.id}>
                                <td>{row.car_id?.name || "—"}</td>
                                <td>{row.status === "mounted" ? "🟢 Montato" : "⚪ Smontato"}</td>
                                <td>
                                  {row.mounted_at
                                    ? new Date(row.mounted_at).toLocaleDateString("it-IT")
                                    : "—"}
                                </td>
                                <td>
                                  {row.removed_at
                                    ? new Date(row.removed_at).toLocaleDateString("it-IT")
                                    : "—"}
                                </td>
                                <td>
                                  {row.hours_used !== null && row.hours_used !== undefined
                                    ? formatHours(row.hours_used)
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {modalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={resetComponentModalState} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-black text-yellow-400">
                <h3 className="text-xl font-bold">
                  {editing ? "Modifica componente" : "Aggiungi componente"}
                </h3>
                <button
                  onClick={resetComponentModalState}
                  className="rounded-lg px-3 py-1 text-yellow-300 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveComponent} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-neutral-700 font-semibold mb-1">Tipo</label>
                  {editing ? (
                    <div className="border rounded-xl p-3 w-full bg-neutral-50 font-bold capitalize">
                      {editing.type}
                    </div>
                  ) : (
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, type: e.target.value }))
                      }
                      required
                      className="border rounded-xl p-3 w-full bg-white"
                    >
                      <option value="">— Seleziona tipo —</option>
                      {COMPONENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-neutral-700 font-semibold mb-1">
                    Identificativo
                  </label>
                  <input
                    value={formData.identifier}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, identifier: e.target.value }))
                    }
                    required
                    placeholder="Es. Motore Pista #01"
                    className="border rounded-xl p-3 w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-700 font-semibold mb-1">
                    Scadenza (opzionale)
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, expiry_date: e.target.value }))
                    }
                    className="border rounded-xl p-3 w-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-neutral-700 font-semibold mb-1">
                      Soglia attenzione ore
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.warning_threshold_hours}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          warning_threshold_hours: e.target.value,
                        }))
                      }
                      className="border rounded-xl p-3 w-full"
                      placeholder="Es. 10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-neutral-700 font-semibold mb-1">
                      Soglia revisione ore
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.revision_threshold_hours}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          revision_threshold_hours: e.target.value,
                        }))
                      }
                      className="border rounded-xl p-3 w-full"
                      placeholder="Es. 20"
                    />
                  </div>
                </div>

                {editing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MiniInfoCard label="Ore attuali" value={formatHours(editing.hours)} />
                    <MiniInfoCard label="Ore vita totale" value={formatHours(editing.life_hours)} />
                  </div>
                )}

                <div>
                  <label className="block text-sm text-neutral-700 font-semibold mb-1">
                    Auto (opzionale)
                  </label>
                  <select
                    value={formData.car_id}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, car_id: e.target.value }))
                    }
                    className="border rounded-xl p-3 w-full bg-white"
                  >
                    <option value="">— Nessuna (smontato) —</option>
                    {cars.map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.name} {car.chassis_number ? `(${car.chassis_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetComponentModalState}
                    className="btn-secondary"
                  >
                    Annulla
                  </button>
                  <button type="submit" className="btn-primary">
                    Salva
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {revisionModalOpen && selectedComponent && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={resetRevisionModalState} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-black text-yellow-400">
                <h3 className="text-xl font-bold">Revisione componente</h3>
                <button
                  onClick={resetRevisionModalState}
                  className="rounded-lg px-3 py-1 text-yellow-300 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveRevision} className="p-6 space-y-4">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                  <div>
                    <span className="font-semibold">Componente:</span> {selectedComponent.type} -{" "}
                    {selectedComponent.identifier}
                  </div>
                  <div>
                    <span className="font-semibold">Ore attuali:</span>{" "}
                    {formatHours(selectedComponent.hours)}
                  </div>
                  <div>
                    <span className="font-semibold">Ore vita totale:</span>{" "}
                    {formatHours(selectedComponent.life_hours)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-neutral-700 font-semibold mb-1">Data</label>
                  <input
                    type="date"
                    value={revisionForm.date}
                    onChange={(e) =>
                      setRevisionForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="border rounded-xl p-3 w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-700 font-semibold mb-1">
                    Descrizione
                  </label>
                  <input
                    value={revisionForm.description}
                    onChange={(e) =>
                      setRevisionForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="border rounded-xl p-3 w-full"
                    placeholder="Es. Revisione completa"
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-700 font-semibold mb-1">Note</label>
                  <textarea
                    value={revisionForm.notes}
                    onChange={(e) =>
                      setRevisionForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className="border rounded-xl p-3 w-full min-h-[100px]"
                    placeholder="Dettagli intervento..."
                  />
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={revisionForm.reset_hours}
                    onChange={(e) =>
                      setRevisionForm((prev) => ({
                        ...prev,
                        reset_hours: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm font-semibold text-neutral-800">
                    Azzera ore attuali del componente
                  </span>
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetRevisionModalState}
                    className="btn-secondary"
                  >
                    Annulla
                  </button>
                  <button type="submit" className="btn-primary">
                    Salva revisione
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {mountModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Monta {selectedComponent?.identifier}
            </h2>

            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="border rounded-xl px-3 py-3 w-full mb-4"
            >
              <option value="">Seleziona auto</option>
              {cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.name} {car.chassis_number ? `(${car.chassis_number})` : ""}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3">
              <button onClick={resetMountModalState} className="btn-secondary">
                Annulla
              </button>
              <button onClick={handleMountComponent} className="btn-primary">
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 z-[999] ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-neutral-50 p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-xl font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
