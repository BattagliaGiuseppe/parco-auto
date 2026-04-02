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
  car_id: string | null;
  car: { id: string; name: string } | null;
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
  return Number(value ?? 0).toFixed(2);
}

function getExpiryColor(date: string) {
  const expiry = new Date(date);
  const now = new Date();

  if (expiry < now) return "text-red-600 font-bold";

  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  if (months > 12) return "text-green-600 font-semibold";
  if (months > 6) return "text-yellow-500 font-semibold";
  return "text-orange-500 font-semibold";
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
      className: "bg-yellow-100 text-yellow-700",
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
          .select("id, component_id, car_id, status, mounted_at, removed_at, hours_used")
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
        const carId = (rawRow as any).car_id as string | null;
        const matchedCar = normalizedCars.find((car) => car.id === carId);

        const row: MountHistoryRow = {
          id: (rawRow as any).id,
          component_id: (rawRow as any).component_id,
          car_id: carId,
          status: (rawRow as any).status,
          mounted_at: (rawRow as any).mounted_at,
          removed_at: (rawRow as any).removed_at,
          hours_used: (rawRow as any).hours_used,
          car: matchedCar ? { id: matchedCar.id, name: matchedCar.name } : null,
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
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Cog size={32} className="text-yellow-500" /> Componenti
        </h1>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per tipo, identificativo o auto..."
              className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm pl-9 focus:ring-2 focus:ring-yellow-400"
            />
            <Search
              size={16}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>

          <select
            value={filterCar}
            onChange={(e) => setFilterCar(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
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
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
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
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
          >
            <option value="all">Tutti</option>
            <option value="expiring">In scadenza (≤ 6 mesi)</option>
            <option value="expired">Scaduti</option>
          </select>

          <button
            onClick={openCreateModal}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <PlusCircle size={18} /> Aggiungi
          </button>
        </div>
      </div>

      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredComponents.map((component) => {
            const threshold = getThresholdBadge(component);
            const latestRevision = revisions[component.id]?.[0];

            return (
              <div
                key={component.id}
                className="bg-white shadow-md rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
              >
                <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-bold capitalize flex items-center gap-2">
                      {component.type}
                      {component.car_id ? (
                        <span className="text-yellow-400 text-xs font-semibold">🟡 Montato</span>
                      ) : (
                        <span className="text-gray-400 text-xs font-semibold">⚪ Smontato</span>
                      )}
                    </h2>
                    <span className="text-sm opacity-80">
                      {component.car_id?.name || "Smontato"}
                    </span>
                  </div>
                  <Wrench size={20} />
                </div>

                <div className="p-4 flex flex-col gap-3">
                  <p className="text-gray-700 text-sm">
                    <span className="font-semibold">Identificativo:</span> {component.identifier}
                  </p>

                  <p className="text-gray-700 text-sm">
                    <span className="font-semibold">Ore attuali:</span> {formatHours(component.hours)}
                  </p>

                  <p className="text-gray-700 text-sm">
                    <span className="font-semibold">Ore vita totale:</span>{" "}
                    {formatHours(component.life_hours)}
                  </p>

                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">Soglie:</span> attenzione{" "}
                    <span className="font-medium">
                      {component.warning_threshold_hours !== null &&
                      component.warning_threshold_hours !== undefined
                        ? formatHours(component.warning_threshold_hours)
                        : "—"}
                    </span>{" "}
                    / revisione{" "}
                    <span className="font-medium">
                      {component.revision_threshold_hours !== null &&
                      component.revision_threshold_hours !== undefined
                        ? formatHours(component.revision_threshold_hours)
                        : "—"}
                    </span>
                  </div>

                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${threshold.className}`}
                    >
                      {threshold.label}
                    </span>
                  </div>

                  {component.expiry_date && (
                    <p className={`text-sm ${getExpiryColor(component.expiry_date)}`}>
                      <span className="font-semibold">Scadenza:</span>{" "}
                      {new Date(component.expiry_date).toLocaleDateString("it-IT")}
                    </p>
                  )}

                  <p className="text-gray-700 text-sm">
                    <span className="font-semibold">Ultima revisione:</span>{" "}
                    {latestRevision?.date
                      ? new Date(latestRevision.date).toLocaleDateString("it-IT")
                      : "—"}
                  </p>

                  <div className="flex justify-end gap-2 flex-wrap">
                    <button
                      onClick={() => openEditModal(component)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                    >
                      <Edit size={16} /> Modifica
                    </button>

                    <button
                      onClick={() => openRevisionModal(component)}
                      className="bg-black hover:bg-gray-800 text-yellow-400 font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                    >
                      <RotateCcw size={16} /> Revisione
                    </button>

                    {!component.car_id ? (
                      <button
                        onClick={() => openMountModal(component)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-3 py-2 rounded-lg shadow-sm"
                      >
                        🧩 Monta
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnmountComponent(component.id)}
                        className="bg-gray-200 hover:bg-gray-300 text-black font-semibold px-3 py-2 rounded-lg shadow-sm"
                      >
                        ❌ Smonta
                      </button>
                    )}
                  </div>

                  {revisions[component.id]?.length > 0 && (
                    <div className="mt-3 border-t pt-2">
                      <h3 className="font-semibold text-sm mb-1">Ultime revisioni</h3>
                      <table className="w-full text-xs border">
                        <thead className="bg-gray-200 text-gray-700">
                          <tr>
                            <th className="p-1 text-left">Data</th>
                            <th className="p-1 text-left">Reset</th>
                            <th className="p-1 text-left">Ore prima</th>
                            <th className="p-1 text-left">Ore dopo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revisions[component.id].slice(0, 3).map((revision) => (
                            <tr key={revision.id} className="border-t">
                              <td className="p-1">
                                {new Date(revision.date).toLocaleDateString("it-IT")}
                              </td>
                              <td className="p-1">{revision.reset_hours ? "Sì" : "No"}</td>
                              <td className="p-1">
                                {revision.hours_before_reset !== null
                                  ? formatHours(revision.hours_before_reset)
                                  : "—"}
                              </td>
                              <td className="p-1">
                                {revision.hours_after_reset !== null
                                  ? formatHours(revision.hours_after_reset)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {history[component.id]?.length > 0 && (
                    <div className="mt-3 border-t pt-2">
                      <h3 className="font-semibold text-sm mb-1">Storico montaggi</h3>
                      <table className="w-full text-xs border">
                        <thead className="bg-gray-200 text-gray-700">
                          <tr>
                            <th className="p-1 text-left">Auto</th>
                            <th className="p-1 text-left">Stato</th>
                            <th className="p-1 text-left">Da</th>
                            <th className="p-1 text-left">A</th>
                            <th className="p-1 text-left">Ore</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history[component.id].map((row) => (
                            <tr key={row.id} className="border-t">
                              <td className="p-1">{row.car?.name || "—"}</td>
                              <td className="p-1">
                                {row.status === "mounted" ? "🟢 Montato" : "⚪ Smontato"}
                              </td>
                              <td className="p-1">
                                {row.mounted_at
                                  ? new Date(row.mounted_at).toLocaleDateString("it-IT")
                                  : "—"}
                              </td>
                              <td className="p-1">
                                {row.removed_at
                                  ? new Date(row.removed_at).toLocaleDateString("it-IT")
                                  : "—"}
                              </td>
                              <td className="p-1">
                                {row.hours_used !== null && row.hours_used !== undefined
                                  ? formatHours(row.hours_used)
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={resetComponentModalState} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  {editing ? "Modifica componente" : "Aggiungi componente"}
                </h3>
                <button
                  onClick={resetComponentModalState}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveComponent} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 font-semibold">Tipo</label>
                  {editing ? (
                    <div className="border rounded-lg p-2 w-full bg-gray-50 font-bold capitalize">
                      {editing.type}
                    </div>
                  ) : (
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, type: e.target.value }))
                      }
                      required
                      className="border rounded-lg p-2 w-full bg-white"
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
                  <label className="block text-sm text-gray-700 font-semibold">
                    Identificativo
                  </label>
                  <input
                    value={formData.identifier}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, identifier: e.target.value }))
                    }
                    required
                    placeholder="Es. Motore Pista #01"
                    className="border rounded-lg p-2 w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 font-semibold">
                    Scadenza (opzionale)
                  </label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, expiry_date: e.target.value }))
                    }
                    className="border rounded-lg p-2 w-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 font-semibold">
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
                      className="border rounded-lg p-2 w-full"
                      placeholder="Es. 10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 font-semibold">
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
                      className="border rounded-lg p-2 w-full"
                      placeholder="Es. 20"
                    />
                  </div>
                </div>

                {editing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-2 w-full bg-gray-50">
                      <span className="text-sm text-gray-700 font-semibold">Ore attuali:</span>{" "}
                      {formatHours(editing.hours)}
                    </div>
                    <div className="border rounded-lg p-2 w-full bg-gray-50">
                      <span className="text-sm text-gray-700 font-semibold">
                        Ore vita totale:
                      </span>{" "}
                      {formatHours(editing.life_hours)}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm text-gray-700 font-semibold">
                    Auto (opzionale)
                  </label>
                  <select
                    value={formData.car_id}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, car_id: e.target.value }))
                    }
                    className="border rounded-lg p-2 w-full bg-white"
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
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                  >
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
          <div className="fixed inset-0 z-40 bg-black/50" onClick={resetRevisionModalState} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">Revisione componente</h3>
                <button
                  onClick={resetRevisionModalState}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveRevision} className="p-6 space-y-4">
                <div className="border rounded-lg p-3 bg-gray-50 text-sm">
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
                  <label className="block text-sm text-gray-700 font-semibold">Data</label>
                  <input
                    type="date"
                    value={revisionForm.date}
                    onChange={(e) =>
                      setRevisionForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="border rounded-lg p-2 w-full"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 font-semibold">
                    Descrizione
                  </label>
                  <input
                    value={revisionForm.description}
                    onChange={(e) =>
                      setRevisionForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="border rounded-lg p-2 w-full"
                    placeholder="Es. Revisione completa"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 font-semibold">Note</label>
                  <textarea
                    value={revisionForm.notes}
                    onChange={(e) =>
                      setRevisionForm((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    className="border rounded-lg p-2 w-full min-h-[100px]"
                    placeholder="Dettagli intervento..."
                  />
                </div>

                <label className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer">
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
                  <span className="text-sm font-semibold text-gray-800">
                    Azzera ore attuali del componente
                  </span>
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={resetRevisionModalState}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                  >
                    Salva revisione
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {mountModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Monta {selectedComponent?.identifier}
            </h2>

            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full mb-4 focus:ring-2 focus:ring-yellow-400"
            >
              <option value="">Seleziona auto</option>
              {cars.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.name} {car.chassis_number ? `(${car.chassis_number})` : ""}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3">
              <button onClick={resetMountModalState} className="px-4 py-2 rounded-lg border">
                Annulla
              </button>
              <button
                onClick={handleMountComponent}
                className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 z-[999] ${
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
