"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, PlusCircle, Search, Cog } from "lucide-react"; // icona ingranaggio
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [filterCar, setFilterCar] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Modale
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // Popup conferma cambio auto
  const [confirmPopup, setConfirmPopup] = useState<{
    show: boolean;
    oldCar: string | null;
    newCar: string | null;
  }>({ show: false, oldCar: null, newCar: null });

  const fetchComponents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("components")
      .select(
        "id, type, identifier, expiry_date, is_active, last_maintenance_date, car_id (name)"
      )
      .order("id", { ascending: true });

    if (!error) setComponents(data || []);
    setLoading(false);
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

  // Applica i filtri
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

  const openAddModal = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEditModal = (comp: any) => {
    setEditing(comp);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalOpen(false);
    if (editing) {
      console.log("Aggiorna componente:", editing.id);
    } else {
      console.log("Aggiungi nuovo componente");
    }
    await fetchComponents();
  };

  const unassignedComponents = components.filter((c) => !c.car_id?.name);

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

          {/* Filtro auto */}
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

          {/* Filtro tipo */}
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

          {/* Filtro scadenze */}
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
            onClick={openAddModal}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <PlusCircle size={18} /> Aggiungi
          </button>
        </div>
      </div>

      {/* Lista componenti assegnati */}
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredComponents
              .filter((c) => c.car_id?.name)
              .map((comp) => (
                <div
                  key={comp.id}
                  className="bg-gray-100 shadow-md rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
                >
                  <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-bold capitalize">{comp.type}</h2>
                      <span className="text-sm opacity-80">{comp.car_id?.name}</span>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col gap-3">
                    <p className="text-gray-700 text-sm">
                      <span className="font-semibold">Identificativo:</span> {comp.identifier}
                    </p>
                    {comp.expiry_date && (
                      <p className={`text-sm ${getExpiryColor(comp.expiry_date)}`}>
                        <span className="font-semibold">Scadenza:</span>{" "}
                        {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                      </p>
                    )}
                    {comp.last_maintenance_date && (
                      <p className="text-sm text-gray-600">
                        Ultima manutenzione:{" "}
                        <span className="font-semibold text-blue-600">
                          {new Date(comp.last_maintenance_date).toLocaleDateString("it-IT")}
                        </span>
                      </p>
                    )}
                    <div className="flex justify-end">
                      <button
                        onClick={() => openEditModal(comp)}
                        className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                      >
                        <Edit size={16} /> Modifica
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Sezione smontati */}
          {unassignedComponents.length > 0 && (
            <div className="mt-10">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                ⚠️ Componenti smontati ({unassignedComponents.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unassignedComponents.map((comp) => (
                  <div
                    key={comp.id}
                    className="bg-gray-100 shadow-md rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
                  >
                    <div className="bg-black text-yellow-500 px-4 py-3">
                      <h2 className="text-lg font-bold capitalize">{comp.type}</h2>
                      <span className="text-sm opacity-80">Smontato</span>
                    </div>
                    <div className="p-4 flex flex-col gap-3">
                      <p className="text-gray-700 text-sm">
                        <span className="font-semibold">Identificativo:</span>{" "}
                        {comp.identifier}
                      </p>
                      {comp.expiry_date && (
                        <p className={`text-sm ${getExpiryColor(comp.expiry_date)}`}>
                          <span className="font-semibold">Scadenza:</span>{" "}
                          {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                        </p>
                      )}
                      <div className="flex justify-end">
                        <button
                          onClick={() => openEditModal(comp)}
                          className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                        >
                          <Edit size={16} /> Modifica
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modale */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">
              {editing ? "Modifica componente" : "Aggiungi componente"}
            </h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              {/* Tipo */}
              {editing ? (
                <p className="font-bold text-gray-800">Tipo: {editing.type}</p>
              ) : (
                <select className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400">
                  <option value="">Seleziona tipo</option>
                  {[...new Set(components.map((c) => c.type).filter(Boolean))].map(
                    (type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    )
                  )}
                  <option value="altro">Altro…</option>
                </select>
              )}

              {/* Identificativo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Identificativo
                </label>
                <input
                  type="text"
                  defaultValue={editing?.identifier || ""}
                  placeholder={editing ? "" : "Identificativo"}
                  className="border rounded-lg px-3 py-2 placeholder-gray-400 focus:ring-2 focus:ring-yellow-400 w-full"
                />
              </div>

              {/* Scadenza */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Scadenza
                </label>
                <input
                  type="date"
                  defaultValue={editing?.expiry_date?.split("T")[0] || ""}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400 w-full"
                />
              </div>

              {/* Auto */}
              <select
                defaultValue={editing?.car_id?.name || ""}
                onChange={(e) => {
                  const newCar = e.target.value;
                  if (editing && editing.car_id?.name !== newCar) {
                    setConfirmPopup({
                      show: true,
                      oldCar: editing.car_id?.name || "",
                      newCar: newCar,
                    });
                  }
                }}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
              >
                <option value="">Smontato</option>
                {[...new Set(
                  components.map((c) => c.car_id?.name).filter(Boolean)
                )].map((car) => (
                  <option key={car} value={car}>
                    {car}
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
                  className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup cambio auto */}
      {confirmPopup.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Conferma cambio auto</h3>
            <p className="text-gray-700 mb-6">
              Vuoi smontare questo componente da{" "}
              <span className="font-semibold">{confirmPopup.oldCar || "nessuna"}</span>{" "}
              e montarlo su{" "}
              <span className="font-semibold">{confirmPopup.newCar || "Smontato"}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() =>
                  setConfirmPopup({ show: false, oldCar: null, newCar: null })
                }
                className="px-4 py-2 rounded-lg border"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (editing) {
                    setEditing({
                      ...editing,
                      car_id: confirmPopup.newCar
                        ? { name: confirmPopup.newCar }
                        : null,
                    });
                  }
                  setConfirmPopup({ show: false, oldCar: null, newCar: null });
                }}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
