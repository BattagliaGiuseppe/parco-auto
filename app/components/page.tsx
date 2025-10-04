"use client";

import { useState, useEffect } from "react";
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

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [filterCar, setFilterCar] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [mountModal, setMountModal] = useState(false);
  const [remountModal, setRemountModal] = useState(false);

  const [editing, setEditing] = useState<any | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<any | null>(null);
  const [selectedCarId, setSelectedCarId] = useState<string>("");

  const [formData, setFormData] = useState({
    type: "",
    identifier: "",
    work_hours: 0,
    expiry_date: "",
    car_name: "",
  });

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: "", type }), 3000);
  };

  // Carica componenti, auto e storico
  const fetchComponents = async () => {
    setLoading(true);

    const { data: comps } = await supabase
      .from("components")
      .select(
        "id, type, identifier, expiry_date, last_maintenance_date, work_hours, car_id (id, name)"
      )
      .order("id", { ascending: true });

    const { data: carsData } = await supabase.from("cars").select("id, name");

    setComponents(comps || []);
    setCars(carsData || []);
    setLoading(false);

    // Carica storico montaggi per ogni componente
    const historyData: Record<string, any[]> = {};
    for (const comp of comps || []) {
      const { data: hist } = await supabase
        .from("car_components")
        .select("id, car_id (name), status, mounted_at, removed_at, hours_used")
        .eq("component_id", comp.id)
        .order("mounted_at", { ascending: false });
      historyData[comp.id] = hist || [];
    }
    setHistory(historyData);
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  const getExpiryColor = (date: string) => {
    const expiry = new Date(date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth() - now.getMonth());

    if (months > 12) return "text-green-600 font-semibold";
    if (months > 6) return "text-yellow-500 font-semibold";
    if (expiry < now) return "text-red-600 font-bold";
    return "text-orange-500";
  };

  // MONTAGGIO MANUALE
  const handleMountComponent = async () => {
    if (!selectedCarId || !selectedComponent) {
      alert("Seleziona un'auto per montare il componente");
      return;
    }

    const { error } = await supabase.rpc("mount_component", {
      p_car_id: selectedCarId,
      p_component_id: selectedComponent.id,
    });

    if (error) {
      console.error("Errore montaggio:", error);
      showToast("❌ Errore montaggio: " + error.message, "error");
    } else {
      showToast("✅ Componente montato con successo", "success");
      setMountModal(false);
      fetchComponents();
    }
  };

  // SMONTAGGIO MANUALE
  const handleUnmountComponent = async (componentId: string) => {
    if (!confirm("Vuoi davvero smontare questo componente?")) return;

    const { error } = await supabase.rpc("unmount_component", {
      p_car_component_id: componentId,
    });

    if (error) {
      console.error("Errore smontaggio:", error);
      showToast("❌ Errore smontaggio: " + error.message, "error");
    } else {
      showToast("✅ Componente smontato", "success");
      fetchComponents();
    }
  };

  // RIMONTAGGIO SU ALTRA AUTO
  const handleRemountComponent = async () => {
    if (!selectedCarId || !selectedComponent) {
      alert("Seleziona un'auto per rimontare il componente");
      return;
    }

    const lastRecord = history[selectedComponent.id]?.[0];
    if (!lastRecord) {
      alert("Nessun record di montaggio precedente trovato");
      return;
    }

    const { error } = await supabase.rpc("remount_component", {
      p_car_component_id: lastRecord.id,
      p_new_car_id: selectedCarId,
    });

    if (error) {
      console.error("Errore rimontaggio:", error);
      showToast("❌ Errore rimontaggio: " + error.message, "error");
    } else {
      showToast("✅ Componente rimontato su nuova auto", "success");
      setRemountModal(false);
      fetchComponents();
    }
  };

  // SALVATAGGIO / MODIFICA
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let car_id = null;
    if (formData.car_name) {
      const { data: car } = await supabase
        .from("cars")
        .select("id")
        .eq("name", formData.car_name)
        .single();
      car_id = car?.id || null;
    }

    if (editing) {
      const oldCarId = editing.car_id?.id || null;
      const newCarId = car_id;

      const { error } = await supabase
        .from("components")
        .update({
          identifier: formData.identifier,
          work_hours: formData.work_hours,
          expiry_date: formData.expiry_date || null,
          car_id: newCarId,
        })
        .eq("id", editing.id);

      if (error) {
        console.error("Errore update:", error);
        showToast("❌ Errore durante l'aggiornamento", "error");
      } else {
        showToast("✅ Componente aggiornato con successo", "success");

        // logica montaggio/smontaggio automatico
        if (oldCarId !== newCarId) {
          if (oldCarId) {
            await supabase.rpc("unmount_component", {
              p_car_component_id: editing.id,
            });
          }
          if (newCarId) {
            await supabase.rpc("mount_component", {
              p_car_id: newCarId,
              p_component_id: editing.id,
            });
          }
        }
      }
    } else {
      const { error } = await supabase.from("components").insert([
        {
          type: formData.type,
          identifier: formData.identifier,
          work_hours: formData.work_hours,
          expiry_date: formData.expiry_date || null,
          car_id: car_id,
        },
      ]);

      if (error) {
        console.error("Errore insert:", error);
        showToast("❌ Errore durante l'inserimento", "error");
      } else {
        showToast("✅ Componente aggiunto con successo", "success");
      }
    }

    setModalOpen(false);
    await fetchComponents();
  };

  // --- FILTRI ---
  const filteredComponents = components.filter((c) => {
    if (filterCar === "unassigned") {
      if (c.car_id?.name) return false;
    } else if (filterCar && c.car_id?.name !== filterCar) {
      return false;
    }

    if (filterType && c.type !== filterType) return false;

    const matchSearch =
      c.type.toLowerCase().includes(search.toLowerCase()) ||
      c.identifier.toLowerCase().includes(search.toLowerCase()) ||
      (c.car_id?.name || "").toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    if (!c.expiry_date) return true;
    const expiry = new Date(c.expiry_date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth() - now.getMonth());

    if (filter === "all") return true;
    if (filter === "expiring") return months <= 6 && months >= 0;
    if (filter === "expired") return expiry < now;
    return true;
  });

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Cog size={32} className="text-yellow-500" /> Componenti
        </h1>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Ricerca e filtri */}
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
            {[...new Set(
              components.map((c) => c.car_id?.name).filter(Boolean)
            )].map((car) => (
              <option key={car} value={car}>
                {car}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
          >
            <option value="">Tutti i tipi</option>
            {[...new Set(
              components.map((c) => c.type).filter(Boolean)
            )].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
          >
            <option value="all">Tutti</option>
            <option value="expiring">In scadenza (≤ 6 mesi)</option>
            <option value="expired">Scaduti</option>
          </select>

          <button
            onClick={() => {
              setEditing(null);
              setFormData({
                type: "",
                identifier: "",
                work_hours: 0,
                expiry_date: "",
                car_name: "",
              });
              setModalOpen(true);
            }}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <PlusCircle size={18} /> Aggiungi
          </button>
        </div>
      </div>

      {/* Lista componenti */}
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredComponents.map((comp) => (
            <div
              key={comp.id}
              className="bg-gray-100 shadow-md rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold capitalize">{comp.type}</h2>
                  <span className="text-sm opacity-80">
                    {comp.car_id?.name || "Smontato"}
                  </span>
                </div>
                <Wrench size={20} />
              </div>

              <div className="p-4 flex flex-col gap-3">
                <p className="text-gray-700 text-sm">
                  <span className="font-semibold">Identificativo:</span>{" "}
                  {comp.identifier}
                </p>
                <p className="text-gray-700 text-sm">
                  <span className="font-semibold">Ore lavoro:</span>{" "}
                  {comp.work_hours}
                </p>

                {comp.expiry_date && (
                  <p className={`text-sm ${getExpiryColor(comp.expiry_date)}`}>
                    <span className="font-semibold">Scadenza:</span>{" "}
                    {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                  </p>
                )}

                {/* Pulsanti azione */}
                <div className="flex justify-end gap-2 flex-wrap">
                  <button
                    onClick={() => openEditModal(comp)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                  >
                    <Edit size={16} /> Modifica
                  </button>

                  {!comp.car_id ? (
                    <button
                      onClick={() => {
                        setSelectedComponent(comp);
                        setMountModal(true);
                      }}
                      className="bg-green-400 hover:bg-green-500 text-gray-900 font-semibold px-3 py-2 rounded-lg shadow-sm"
                    >
                      🧩 Monta
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleUnmountComponent(comp.id)}
                        className="bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-2 rounded-lg shadow-sm"
                      >
                        ❌ Smonta
                      </button>
                      <button
                        onClick={() => {
                          setSelectedComponent(comp);
                          setRemountModal(true);
                        }}
                        className="bg-blue-400 hover:bg-blue-500 text-white font-semibold px-3 py-2 rounded-lg shadow-sm flex items-center gap-1"
                      >
                        <RotateCcw size={16} /> Rimonta
                      </button>
                    </>
                  )}
                </div>

                {/* Storico montaggi */}
                {history[comp.id]?.length > 0 && (
                  <div className="mt-3 border-t pt-2">
                    <h3 className="font-semibold text-sm mb-1">
                      Storico Montaggi:
                    </h3>
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
                        {history[comp.id].map((h) => (
                          <tr key={h.id} className="border-t">
                            <td className="p-1">{h.car_id?.name || "—"}</td>
                            <td className="p-1">
                              {h.status === "mounted"
                                ? "🟢 Montato"
                                : "⚪️ Smontato"}
                            </td>
                            <td className="p-1">
                              {h.mounted_at
                                ? new Date(h.mounted_at).toLocaleDateString(
                                    "it-IT"
                                  )
                                : "—"}
                            </td>
                            <td className="p-1">
                              {h.removed_at
                                ? new Date(h.removed_at).toLocaleDateString(
                                    "it-IT"
                                  )
                                : "—"}
                            </td>
                            <td className="p-1">
                              {h.hours_used?.toFixed(1) || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale Montaggio */}
      {mountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Monta {selectedComponent?.identifier} su un'auto
            </h2>

            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full mb-6 focus:ring-2 focus:ring-yellow-400"
            >
              <option value="">-- Seleziona auto --</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMountModal(false)}
                className="px-4 py-2 rounded-lg border"
              >
                Annulla
              </button>
              <button
                onClick={handleMountComponent}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                Monta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Rimontaggio */}
      {remountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Rimonta {selectedComponent?.identifier} su una nuova auto
            </h2>

            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full mb-6 focus:ring-2 focus:ring-yellow-400"
            >
              <option value="">-- Seleziona auto --</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRemountModal(false)}
                className="px-4 py-2 rounded-lg border"
              >
                Annulla
              </button>
              <button
                onClick={handleRemountComponent}
                className="px-4 py-2 rounded-lg bg-blue-400 hover:bg-blue-500 text-white font-semibold"
              >
                Rimonta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 z-[999]
          ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <XCircle size={18} />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
