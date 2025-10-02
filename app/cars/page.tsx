"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import {
  Edit,
  Info,
  List,
  Grid,
  Search,
  FileText,
  Printer,
  X,
} from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type ComponentBase = { type: string; identifier: string };
type ComponentExp = { type: string; identifier: string; expiry: string }; // YYYY-MM-DD
type ComponentType =
  | "motore"
  | "cambio"
  | "differenziale"
  | "cinture"
  | "cavi"
  | "estintore"
  | "serbatoio"
  | "passaporto";

const COMPONENT_TYPES: ComponentType[] = [
  "motore",
  "cambio",
  "differenziale",
  "cinture",
  "cavi",
  "estintore",
  "serbatoio",
  "passaporto",
];

const EXP_RULES: Record<
  Exclude<ComponentType, "motore" | "cambio" | "differenziale">,
  number
> = {
  cinture: 5,
  cavi: 2,
  estintore: 2,
  serbatoio: 5,
  passaporto: 10,
};

const defaultLabel: Record<ComponentType, string> = {
  motore: "Motore",
  cambio: "Cambio",
  differenziale: "Differenziale",
  cinture: "Cinture di sicurezza",
  cavi: "Cavi ritenuta ruote",
  estintore: "Estintore",
  serbatoio: "Serbatoio carburante",
  passaporto: "Passaporto tecnico",
};

function addYearsYYYYMMDD(years: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [view, setView] = useState<"sintetica" | "dettagliata">("sintetica");

  // ricerca
  const [search, setSearch] = useState("");
  const [searchBy, setSearchBy] = useState<"auto" | ComponentType>("auto");

  // modal add/edit/details
  const [openModal, setOpenModal] = useState<null | "add" | "edit" | "details">(
    null
  );
  const [saving, setSaving] = useState(false);
  const [editingCar, setEditingCar] = useState<any>(null);

  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");

  const [baseComponents, setBaseComponents] = useState<ComponentBase[]>([]);
  const [expiringComponents, setExpiringComponents] = useState<ComponentExp[]>(
    []
  );

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select(
        "id, name, chassis_number, components(id, type, identifier, expiry_date, is_active)"
      )
      .order("id", { ascending: true });

    if (!error) setCars(data || []);
  };
  useEffect(() => {
    fetchCars();
  }, []);

  // colori scadenza
  const getExpiryColor = (date: string) => {
    const expiry = new Date(date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth() - now.getMonth());
    if (months > 12) return "text-green-500";
    if (months > 6) return "text-yellow-500";
    return "text-red-500";
  };

  // filtro ricerca
  const filteredCars = cars.filter((car) => {
    if (searchBy === "auto") {
      if (!search.trim()) return true;
      return (
        (car.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (car.chassis_number || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      );
    }
    // filtro per tipo componente
    const comps = (car.components || []).filter((c: any) => c.type === searchBy);
    if (!search.trim()) return comps.length > 0;
    return comps.some((c: any) =>
      (c.identifier || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  // salva nuova auto
  const onSaveCar = async () => {
    if (!name.trim() || !chassis.trim()) return;
    setSaving(true);
    try {
      if (openModal === "add") {
        const { data: newCar, error: carErr } = await supabase
          .from("cars")
          .insert([{ name, chassis_number: chassis }])
          .select()
          .single();
        if (carErr) throw carErr;

        const baseToInsert = ["motore", "cambio", "differenziale"].map((t) => ({
          type: t,
          identifier: `${name} - ${defaultLabel[t as ComponentType]}`,
          car_id: newCar.id,
          is_active: true,
        }));

        const expToInsert = (Object.keys(EXP_RULES) as ComponentType[]).map(
          (t) => ({
            type: t,
            identifier: defaultLabel[t],
            car_id: newCar.id,
            expiry_date: addYearsYYYYMMDD(EXP_RULES[t as keyof typeof EXP_RULES]),
            is_active: true,
          })
        );

        const { error: compErr } = await supabase
          .from("components")
          .insert([...baseToInsert, ...expToInsert]);
        if (compErr) throw compErr;
      }

      if (openModal === "edit" && editingCar) {
        const { error: carErr } = await supabase
          .from("cars")
          .update({ name, chassis_number: chassis })
          .eq("id", editingCar.id);
        if (carErr) throw carErr;
      }

      setOpenModal(null);
      fetchCars();
    } catch (e) {
      console.error("Errore salvataggio auto:", e);
      alert("Errore nel salvataggio.");
    } finally {
      setSaving(false);
    }
  };

  const openForEdit = (car: any) => {
    setEditingCar(car);
    setName(car.name);
    setChassis(car.chassis_number);
    setOpenModal("edit");
  };

  const openForDetails = (car: any) => {
    setEditingCar(car);
    setName(car.name);
    setChassis(car.chassis_number);
    setOpenModal("details");
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Gestione Auto</h1>

        <div className="flex gap-3">
          <button
            onClick={() =>
              setView(view === "sintetica" ? "dettagliata" : "sintetica")
            }
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
          >
            {view === "sintetica" ? (
              <>
                <Grid size={18} /> Vista dettagliata
              </>
            ) : (
              <>
                <List size={18} /> Vista sintetica
              </>
            )}
          </button>

          <button
            onClick={() => setOpenModal("add")}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg"
          >
            + Aggiungi Auto
          </button>
        </div>
      </div>

      {/* Lista Auto */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCars.map((car) => (
          <div
            key={car.id}
            className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
          >
            <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">{car.name}</h2>
                <span className="text-sm opacity-80">
                  {car.chassis_number}
                </span>
              </div>
              {view === "sintetica" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openForEdit(car)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Edit size={16} /> Modifica
                  </button>
                  <button
                    onClick={() => openForDetails(car)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Info size={16} /> Dettagli
                  </button>
                </div>
              )}
            </div>

            {/* Corpo dettagliata */}
            {view === "dettagliata" && (
              <div className="p-4">
                <div className="flex flex-col gap-2">
                  {(car.components || []).map((comp: any) => (
                    <div
                      key={comp.id}
                      className="flex justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg"
                    >
                      <span>
                        {comp.type} – {comp.identifier}
                      </span>
                      {comp.expiry_date && (
                        <span
                          className={`font-medium ${getExpiryColor(
                            comp.expiry_date
                          )}`}
                        >
                          {new Date(comp.expiry_date).toLocaleDateString(
                            "it-IT"
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => openForEdit(car)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Edit size={16} /> Modifica
                  </button>
                </div>
              </div>
            )}

            {/* Footer card */}
            <div className="px-4 pb-4 flex justify-end gap-2">
              <button className="bg-gray-900 hover:bg-gray-800 text-yellow-500 px-3 py-2 rounded-lg flex items-center gap-2">
                <FileText size={16} /> Documenti
              </button>
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2">
                <Printer size={16} /> Stampa
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL */}
      {openModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => !saving && setOpenModal(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  {openModal === "add"
                    ? "Aggiungi Auto"
                    : openModal === "edit"
                    ? "Modifica Auto"
                    : "Dettagli Auto"}
                </h3>
                <button
                  onClick={() => !saving && setOpenModal(null)}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  <X />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-700">Nome auto</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={openModal === "details"}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">
                    Numero telaio
                  </label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={chassis}
                    onChange={(e) => setChassis(e.target.value)}
                    disabled={openModal === "details"}
                  />
                </div>
              </div>

              {openModal !== "details" && (
                <div className="flex justify-end gap-3 px-6 py-4 border-t">
                  <button
                    onClick={() => setOpenModal(null)}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={onSaveCar}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                  >
                    {saving ? "Salvataggio..." : "Salva auto"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
