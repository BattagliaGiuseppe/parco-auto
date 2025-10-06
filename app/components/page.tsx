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
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

// Tipi conosciuti per il select "Tipo" in Aggiungi
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

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [cars, setCars] = useState<any[]>([]);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [filterCar, setFilterCar] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Modali
  const [modalOpen, setModalOpen] = useState(false); // Aggiungi/Modifica
  const [mountModal, setMountModal] = useState(false); // Monta

  // Stato editing/selection
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<any | null>(null);
  const [selectedCarId, setSelectedCarId] = useState<string>("");

  // Form modale Aggiungi/Modifica
  const [formData, setFormData] = useState<{
    type: string;
    identifier: string;
    work_hours: number | null;
    expiry_date: string; // YYYY-MM-DD
    car_id: string; // selezione tramite id (più robusta del nome)
  }>({
    type: "",
    identifier: "",
    work_hours: 0,
    expiry_date: "",
    car_id: "",
  });

  // Toast
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: "", type }), 3000);
  };

  // --- FETCH DATA ---
  const fetchComponents = async () => {
    setLoading(true);
    const { data: comps } = await supabase
      .from("components")
      .select(
        "id, type, identifier, expiry_date, last_maintenance_date, work_hours, car_id (id, name)"
      )
      .order("id", { ascending: true });

    const { data: carsData } = await supabase
      .from("cars")
      .select("id, name, chassis_number")
      .order("name", { ascending: true });

    setCars(carsData || []);
    setComponents(comps || []);
    setLoading(false);

    // Storico montaggi
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

  // --- MONTAGGIO (da card: tasto Monta) ---
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
      showToast("❌ Errore montaggio: " + error.message, "error");
    } else {
      showToast("✅ Componente montato con successo", "success");
      setMountModal(false);
      setSelectedCarId("");
      setSelectedComponent(null);
      fetchComponents();
    }
  };

  // --- SMONTAGGIO (da card: tasto Smonta) ---
  const handleUnmountComponent = async (componentId: string) => {
    if (!confirm("Vuoi davvero smontare questo componente?")) return;
    const { error } = await supabase.rpc("unmount_component", {
      p_car_component_id: componentId, // nella tua base sembra accettare l'id componente
    });
    if (error) {
      showToast("❌ Errore smontaggio: " + error.message, "error");
    } else {
      showToast("✅ Componente smontato", "success");
      fetchComponents();
    }
  };

  // --- SALVA / MODIFICA (modale) ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editing) {
      // AGGIUNTA
      // 1) creo il componente (smontato)
      const { data: inserted, error: insErr } = await supabase
        .from("components")
        .insert([
          {
            type: formData.type,
            identifier: formData.identifier,
            expiry_date: formData.expiry_date || null,
          },
        ])
        .select()
        .single();

      if (insErr || !inserted) {
        showToast("❌ Errore inserimento", "error");
        return;
      }

      // 2) se è stata selezionata un'auto, monto con RPC (crea storico)
      if (formData.car_id) {
        const { error: mErr } = await supabase.rpc("mount_component", {
          p_car_id: formData.car_id,
          p_component_id: inserted.id,
        });
        if (mErr) {
          showToast("⚠️ Componente creato, ma errore nel montaggio: " + mErr.message, "error");
        } else {
          showToast("✅ Componente creato e montato", "success");
        }
      } else {
        showToast("✅ Componente creato (smontato)", "success");
      }

      setModalOpen(false);
      setFormData({
        type: "",
        identifier: "",
        work_hours: 0,
        expiry_date: "",
        car_id: "",
      });
      await fetchComponents();
      return;
    }

    // MODIFICA
    const oldCarId = editing.car_id?.id || null;
    const newCarId = formData.car_id || null;

    // Conferma cambio auto (solo se effettivamente diversa)
    if (oldCarId !== newCarId) {
      const ok = confirm(
        "Questo componente è attualmente associato a un’altra auto. Vuoi confermare lo spostamento?"
      );
      if (!ok) return;
    }

    // 1) aggiorno i campi base (identifier/expiry) — ore lavoro NON modificabili
    const { error: upErr } = await supabase
      .from("components")
      .update({
        identifier: formData.identifier,
        expiry_date: formData.expiry_date || null,
      })
      .eq("id", editing.id);

    if (upErr) {
      showToast("❌ Errore aggiornamento dati componente", "error");
      return;
    }

    // 2) Se cambia l’auto: smonto/monto con RPC (gestisce car_id e storico)
    if (oldCarId !== newCarId) {
      if (oldCarId) {
        const { error: uErr } = await supabase.rpc("unmount_component", {
          p_car_component_id: editing.id,
        });
        if (uErr) {
          showToast("⚠️ Aggiornato ma errore nello smontaggio: " + uErr.message, "error");
          // Continua comunque, poi tenteremo il montaggio
        }
      }
      if (newCarId) {
        const { error: mErr } = await supabase.rpc("mount_component", {
          p_car_id: newCarId,
          p_component_id: editing.id,
        });
        if (mErr) {
          showToast("⚠️ Aggiornato ma errore nel montaggio: " + mErr.message, "error");
        } else {
          showToast("✅ Componente aggiornato e spostato", "success");
        }
      } else {
        showToast("✅ Componente aggiornato e lasciato smontato", "success");
      }
    } else {
      showToast("✅ Componente aggiornato", "success");
    }

    setModalOpen(false);
    setEditing(null);
    await fetchComponents();
  };

  // --- FILTRI ---
  const filteredComponents = components.filter((c) => {
    if (filterCar === "unassigned") {
      if (c.car_id?.name) return false;
    } else if (filterCar && c.car_id?.name !== filterCar) return false;
    if (filterType && c.type !== filterType) return false;

    const needle = search.toLowerCase();
    const hayType = (c.type || "").toLowerCase();
    const hayIdent = (c.identifier || "").toLowerCase();
    const hayCar = (c.car_id?.name || "").toLowerCase();
    const matchSearch = hayType.includes(needle) || hayIdent.includes(needle) || hayCar.includes(needle);
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

  // --- UI ---
  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Cog size={32} className="text-yellow-500" /> Componenti
        </h1>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Ricerca */}
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

          {/* Filtri */}
          <select
            value={filterCar}
            onChange={(e) => setFilterCar(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
          >
            <option value="">Tutte le auto</option>
            <option value="unassigned">Smontati</option>
            {[...new Set(components.map((c) => c.car_id?.name).filter(Boolean))].map((car) => (
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
            {[...new Set(components.map((c) => c.type).filter(Boolean))].map((type) => (
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

          {/* Aggiungi */}
          <button
            onClick={() => {
              setEditing(null);
              setFormData({
                type: "",
                identifier: "",
                work_hours: 0,
                expiry_date: "",
                car_id: "",
              });
              setModalOpen(true);
            }}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <PlusCircle size={18} /> Aggiungi
          </button>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredComponents.map((comp) => (
            <div
              key={comp.id}
              className="bg-white shadow-md rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold capitalize flex items-center gap-2">
                    {comp.type}
                    {comp.car_id ? (
                      <span className="text-yellow-400 text-xs font-semibold">
                        🟡 Montato
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs font-semibold">
                        ⚪ Smontato
                      </span>
                    )}
                  </h2>
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
                  {comp.work_hours ?? 0}
                </p>

                {comp.expiry_date && (
                  <p className={`text-sm ${getExpiryColor(comp.expiry_date)}`}>
                    <span className="font-semibold">Scadenza:</span>{" "}
                    {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                  </p>
                )}

                {/* Pulsanti */}
                <div className="flex justify-end gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setEditing(comp);
                      setFormData({
                        type: comp.type,
                        identifier: comp.identifier,
                        work_hours: comp.work_hours ?? 0,
                        expiry_date: comp.expiry_date
                          ? String(comp.expiry_date).split("T")[0]
                          : "",
                        car_id: comp.car_id?.id || "",
                      });
                      setModalOpen(true);
                    }}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                  >
                    <Edit size={16} /> Modifica
                  </button>

                  {!comp.car_id ? (
                    <button
                      onClick={() => {
                        setSelectedComponent(comp);
                        setSelectedCarId("");
                        setMountModal(true);
                      }}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-3 py-2 rounded-lg shadow-sm"
                    >
                      🧩 Monta
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnmountComponent(comp.id)}
                      className="bg-gray-200 hover:bg-gray-300 text-black font-semibold px-3 py-2 rounded-lg shadow-sm"
                    >
                      ❌ Smonta
                    </button>
                  )}
                </div>

                {/* Storico */}
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
                                : "⚪ Smontato"}
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

      {/* MODALE: Aggiungi / Modifica */}
      {modalOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setModalOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  {editing ? "Modifica componente" : "Aggiungi componente"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleSave}
                className="p-6 space-y-4"
              >
                {/* Tipo */}
                <div>
                  <label className="block text-sm text-gray-700 font-semibold">
                    Tipo
                  </label>
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
                      {COMPONENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Identificativo */}
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

                {/* Scadenza */}
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

                {/* Ore lavoro (solo lettura) */}
                <div>
                  <label className="block text-sm text-gray-700 font-semibold">
                    Ore lavoro
                  </label>
                  <div className="border rounded-lg p-2 w-full bg-gray-50">
                    {formData.work_hours ?? 0}
                  </div>
                </div>

                {/* Auto (opzionale) */}
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
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.chassis_number ? `(${c.chassis_number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
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

      {/* MODALE: Montaggio da card */}
      {mountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
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
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.chassis_number ? `(${c.chassis_number})` : ""}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setMountModal(false);
                  setSelectedCarId("");
                  setSelectedComponent(null);
                }}
                className="px-4 py-2 rounded-lg border"
              >
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
          {toast.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
