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

  // --- FETCH DATA ---
  const fetchComponents = async () => {
    setLoading(true);
    const { data: comps } = await supabase
      .from("components")
      .select(
        "id, type, identifier, expiry_date, last_maintenance_date, work_hours, car_id (id, name)"
      )
      .order("id", { ascending: true });

    const { data: carsData } = await supabase.from("cars").select("id, name");
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

  // --- MONTAGGIO ---
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
      fetchComponents();
    }
  };

  // --- SMONTAGGIO ---
  const handleUnmountComponent = async (componentId: string) => {
    if (!confirm("Vuoi davvero smontare questo componente?")) return;
    const { error } = await supabase.rpc("unmount_component", {
      p_car_component_id: componentId,
    });
    if (error) {
      showToast("❌ Errore smontaggio: " + error.message, "error");
    } else {
      showToast("✅ Componente smontato", "success");
      fetchComponents();
    }
  };

  // --- SALVA / MODIFICA ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let car_id = null;
    if (formData.car_name) {
      const { data: car } = await supabase
        .from("cars")
        .select("id, name")
        .eq("name", formData.car_name)
        .single();
      car_id = car?.id || null;
    }

    if (editing) {
      const oldCarId = editing.car_id?.id || null;
      const newCarId = car_id;

      // Conferma cambio auto
      if (oldCarId && newCarId && oldCarId !== newCarId) {
        const confirmChange = confirm(
          "Questo componente è attualmente montato su un’altra auto. Vuoi spostarlo?"
        );
        if (!confirmChange) return;
      }

      const { error } = await supabase
        .from("components")
        .update({
          identifier: formData.identifier,
          expiry_date: formData.expiry_date || null,
          car_id: newCarId,
        })
        .eq("id", editing.id);

      if (error) showToast("❌ Errore aggiornamento", "error");
      else {
        showToast("✅ Componente aggiornato", "success");
        await fetchComponents();
      }
    } else {
      const { error } = await supabase.from("components").insert([
        {
          type: formData.type,
          identifier: formData.identifier,
          expiry_date: formData.expiry_date || null,
        },
      ]);
      if (error) showToast("❌ Errore inserimento", "error");
      else showToast("✅ Componente aggiunto", "success");
    }
    setModalOpen(false);
    fetchComponents();
  };

  // --- FILTRI ---
  const filteredComponents = components.filter((c) => {
    if (filterCar === "unassigned") {
      if (c.car_id?.name) return false;
    } else if (filterCar && c.car_id?.name !== filterCar) return false;
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

  // --- UI ---
  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
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
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <PlusCircle size={18} /> Aggiungi
          </button>
        </div>
      </div>

      {/* Cards componenti */}
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
                        work_hours: comp.work_hours,
                        expiry_date: comp.expiry_date?.split("T")[0] || "",
                        car_name: comp.car_id?.name || "",
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Montaggio */}
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
