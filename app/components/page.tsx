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
  const [loading, setLoading] = useState(false);

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
    setTimeout(() => setToast({ show: false, message: "", type }), 2500);
  };

  // 🔹 FETCH DATA
  const fetchComponents = async () => {
    setLoading(true);
    const { data: comps } = await supabase
      .from("components")
      .select(
        "id, type, identifier, expiry_date, work_hours, car_id (id, name)"
      )
      .order("id", { ascending: true });
    const { data: carsData } = await supabase
      .from("cars")
      .select("id, name")
      .order("id", { ascending: true });
    setCars(carsData || []);
    setComponents(comps || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  // 🔹 COLORI SCADENZA
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

  // 🔹 MONTAGGIO (gestisce anche smontaggio automatico)
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
      showToast("✅ Componente montato correttamente", "success");
      setMountModal(false);
      fetchComponents();
    }
  };

  // 🔹 SALVATAGGIO / MODIFICA COMPONENTE
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
      const { error } = await supabase
        .from("components")
        .update({
          type: formData.type,
          identifier: formData.identifier,
          work_hours: formData.work_hours,
          expiry_date: formData.expiry_date || null,
          car_id,
        })
        .eq("id", editing.id);
      if (error) showToast("❌ Errore aggiornamento", "error");
      else showToast("✅ Componente aggiornato", "success");
    } else {
      const { error } = await supabase.from("components").insert([
        {
          type: formData.type,
          identifier: formData.identifier,
          work_hours: formData.work_hours,
          expiry_date: formData.expiry_date || null,
          car_id,
        },
      ]);
      if (error) showToast("❌ Errore inserimento", "error");
      else showToast("✅ Componente aggiunto", "success");
    }
    setModalOpen(false);
    fetchComponents();
  };

  // 🔹 FILTRO VISUALE
  const filteredComponents = components.filter((c) => {
    if (filterCar === "unassigned") {
      if (c.car_id?.name) return false;
    } else if (filterCar && c.car_id?.name !== filterCar) return false;
    if (filterType && c.type !== filterType) return false;
    const matchSearch =
      c.type.toLowerCase().includes(search.toLowerCase()) ||
      c.identifier.toLowerCase().includes(search.toLowerCase()) ||
      (c.car_id?.name || "").toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  // 🔹 RENDER
  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* 🔸 STEP 1 - HEADER GRAFICO UNIFICATO */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-black text-yellow-500 rounded-xl p-2">
            <Cog size={22} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Gestione Componenti</h1>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Ricerca */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per tipo, identificativo o auto..."
              className="border rounded-lg pl-9 pr-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* Filtri */}
          <select
            value={filterCar}
            onChange={(e) => setFilterCar(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
          >
            <option value="">Tutte le auto</option>
            <option value="unassigned">Smontati</option>
            {[...new Set(components.map((c) => c.car_id?.name).filter(Boolean))].map(
              (car) => (
                <option key={car} value={car}>
                  {car}
                </option>
              )
            )}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
          >
            <option value="">Tutti i tipi</option>
            {[...new Set(components.map((c) => c.type).filter(Boolean))].map(
              (type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              )
            )}
          </select>

          {/* 🔸 STEP 2 - FIX TASTO AGGIUNGI */}
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
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
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
              className="bg-white shadow-md rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
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

                {/* 🔸 STEP 3 - SOLO “Monta” E “Modifica” */}
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
                    className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                  >
                    <Edit size={16} /> Modifica
                  </button>

                  <button
                    onClick={() => {
                      setSelectedComponent(comp);
                      setMountModal(true);
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white font-semibold px-3 py-2 rounded-lg shadow-sm"
                  >
                    🧩 Monta
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🔹 MODALE AGGIUNGI/MODIFICA */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">
              {editing ? "Modifica Componente" : "Aggiungi Componente"}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <input
                placeholder="Tipo"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="border rounded-lg p-2"
              />
              <input
                placeholder="Identificativo"
                value={formData.identifier}
                onChange={(e) =>
                  setFormData({ ...formData, identifier: e.target.value })
                }
                className="border rounded-lg p-2"
              />
              <input
                type="number"
                placeholder="Ore di lavoro"
                value={formData.work_hours}
                onChange={(e) =>
                  setFormData({ ...formData, work_hours: Number(e.target.value) })
                }
                className="border rounded-lg p-2"
              />
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) =>
                  setFormData({ ...formData, expiry_date: e.target.value })
                }
                className="border rounded-lg p-2"
              />
              <select
                value={formData.car_name}
                onChange={(e) =>
                  setFormData({ ...formData, car_name: e.target.value })
                }
                className="border rounded-lg p-2"
              >
                <option value="">Non assegnato</option>
                {cars.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border"
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
      )}

      {/* 🔹 MODALE MONTA */}
      {mountModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Monta {selectedComponent?.identifier}
            </h2>
            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full mb-4"
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
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 TOAST */}
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
