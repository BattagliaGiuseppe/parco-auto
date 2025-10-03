"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, PlusCircle, Search, Cog, CheckCircle, XCircle } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [filterCar, setFilterCar] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // Stato del form
  const [formData, setFormData] = useState({
    type: "",
    identifier: "",
    work_hours: 0,
    expiry_date: "",
    car_name: "",
  });

  // Toast feedback
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ show: true, message: msg, type });
    setTimeout(() => setToast({ show: false, message: "", type }), 3000);
  };

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
        "id, type, identifier, expiry_date, is_active, last_maintenance_date, car_id (name), work_hours"
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
    setFormData({
      type: "",
      identifier: "",
      work_hours: 0,
      expiry_date: "",
      car_name: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (comp: any) => {
    setEditing(comp);
    setFormData({
      type: comp.type || "",
      identifier: comp.identifier || "",
      work_hours: comp.work_hours || 0,
      expiry_date: comp.expiry_date?.split("T")[0] || "",
      car_name: comp.car_id?.name || "",
    });
    setModalOpen(true);
  };

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
          identifier: formData.identifier,
          work_hours: formData.work_hours,
          expiry_date: formData.expiry_date || null,
          car_id: car_id,
        })
        .eq("id", editing.id);

      if (error) {
        console.error("Errore update:", error);
        showToast("❌ Errore durante l'aggiornamento", "error");
      } else {
        showToast("✅ Componente aggiornato con successo", "success");
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

  const unassignedComponents = components.filter((c) => !c.car_id?.name);

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* ... header, lista componenti e smontati invariati ... */}

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
                <p className="font-bold text-gray-800">Tipo: {formData.type}</p>
              ) : (
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Seleziona tipo</option>
                  {[...new Set(components.map((c) => c.type).filter(Boolean))].map(
                    (type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    )
                  )}
                  <option value="Motore">Motore</option>
                  <option value="Cambio">Cambio</option>
                  <option value="Differenziale">Differenziale</option>
                  <option value="altro">Altro…</option>
                </select>
              )}

              {/* Identificativo */}
              <input
                type="text"
                value={formData.identifier}
                onChange={(e) =>
                  setFormData({ ...formData, identifier: e.target.value })
                }
                placeholder="Identificativo"
                className="border rounded-lg px-3 py-2 placeholder-gray-400 focus:ring-2 focus:ring-yellow-400 w-full"
              />

              {/* Ore lavoro */}
              {(formData.type === "Motore" ||
                formData.type === "Cambio" ||
                formData.type === "Differenziale") && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Ore lavoro
                  </label>
                  <input
                    type="number"
                    value={formData.work_hours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        work_hours: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="Ore lavoro totali"
                    className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400 w-full"
                  />
                </div>
              )}

              {/* Scadenza */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Scadenza
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) =>
                    setFormData({ ...formData, expiry_date: e.target.value })
                  }
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400 w-full"
                />
              </div>

              {/* Auto */}
              <select
                value={formData.car_name}
                onChange={(e) => {
                  const newCar = e.target.value;
                  if (editing && editing.car_id?.name !== newCar) {
                    setConfirmPopup({
                      show: true,
                      oldCar: editing.car_id?.name || "",
                      newCar: newCar,
                    });
                  }
                  setFormData({ ...formData, car_name: newCar });
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
