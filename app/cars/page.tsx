"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Info, List, Grid, Search, FileText, Printer } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type ComponentBase = { id?: string; type: string; identifier: string };
type ComponentExp = { id?: string; type: string; identifier: string; expiry: string }; 
type ComponentType =
  | "motore" | "cambio" | "differenziale"
  | "cinture" | "cavi" | "estintore" | "serbatoio" | "passaporto";

const COMPONENT_TYPES: ComponentType[] = [
  "motore","cambio","differenziale","cinture","cavi","estintore","serbatoio","passaporto"
];

const EXP_RULES: Record<Exclude<ComponentType, "motore"|"cambio"|"differenziale">, number> = {
  cinture: 5, cavi: 2, estintore: 2, serbatoio: 5, passaporto: 10,
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
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export default function CarsPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [view, setView] = useState<"sintetica" | "dettagliata">("sintetica");

  const [search, setSearch] = useState("");
  const [searchBy, setSearchBy] = useState<"auto" | ComponentType>("auto");

  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");

  // stato per modifica
  const [editCar, setEditCar] = useState<any | null>(null);
  const [editBaseComponents, setEditBaseComponents] = useState<ComponentBase[]>([]);
  const [editExpComponents, setEditExpComponents] = useState<ComponentExp[]>([]);

  const [baseComponents, setBaseComponents] = useState<ComponentBase[]>([
    { type: "motore", identifier: "" },
    { type: "cambio", identifier: "" },
    { type: "differenziale", identifier: "" },
  ]);
  const [expiringComponents, setExpiringComponents] = useState<ComponentExp[]>([
    { type: "cinture", identifier: "", expiry: "" },
    { type: "cavi", identifier: "", expiry: "" },
    { type: "estintore", identifier: "", expiry: "" },
    { type: "serbatoio", identifier: "", expiry: "" },
    { type: "passaporto", identifier: "", expiry: "" },
  ]);

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select("id, name, chassis_number, components(id, type, identifier, expiry_date, is_active)")
      .order("id", { ascending: true });
    if (!error) setCars(data || []);
  };
  useEffect(() => { fetchCars(); }, []);

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

  const filteredCars = cars.filter((car) => {
    if (searchBy === "auto") {
      if (!search.trim()) return true;
      return (
        (car.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (car.chassis_number || "").toLowerCase().includes(search.toLowerCase())
      );
    }
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
      const { data: newCar, error: carErr } = await supabase
        .from("cars")
        .insert([{ name, chassis_number: chassis }])
        .select()
        .single();
      if (carErr) throw carErr;

      const baseToInsert = baseComponents.map((b) => ({
        type: b.type,
        identifier: b.identifier || `${name} - ${defaultLabel[b.type as ComponentType]}`,
        car_id: newCar.id,
        is_active: true,
      }));

      const expToInsert = expiringComponents.map((e) => {
        const years = EXP_RULES[e.type as keyof typeof EXP_RULES] ?? 2;
        return {
          type: e.type,
          identifier: e.identifier || defaultLabel[e.type as ComponentType],
          car_id: newCar.id,
          expiry_date: e.expiry || addYearsYYYYMMDD(years),
          is_active: true,
        };
      });

      const { error: compErr } = await supabase.from("components").insert([
        ...baseToInsert,
        ...expToInsert,
      ]);
      if (compErr) throw compErr;

      setOpenAdd(false);
      setName("");
      setChassis("");
      fetchCars();
    } catch (e) {
      console.error("Errore salvataggio auto:", e);
    } finally {
      setSaving(false);
    }
  };

  // salva modifiche auto
  const onUpdateCar = async () => {
    if (!editCar) return;
    setSaving(true);
    try {
      await supabase.from("cars").update({
        name: editCar.name,
        chassis_number: editCar.chassis_number
      }).eq("id", editCar.id);

      for (const b of editBaseComponents) {
        if (b.id) {
          await supabase.from("components").update({
            identifier: b.identifier
          }).eq("id", b.id);
        }
      }

      for (const e of editExpComponents) {
        if (e.id) {
          await supabase.from("components").update({
            identifier: e.identifier,
            expiry_date: e.expiry
          }).eq("id", e.id);
        }
      }

      setOpenEdit(false);
      setEditCar(null);
      fetchCars();
    } catch (e) {
      console.error("Errore aggiornamento auto:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Lista Auto */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCars.map((car) => (
          <div key={car.id} className="bg-white shadow-lg rounded-2xl overflow-hidden border">
            <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">{car.name}</h2>
                <span className="text-sm opacity-80">{car.chassis_number}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditCar({ ...car });
                    setEditBaseComponents(car.components.filter((c: any) =>
                      ["motore","cambio","differenziale"].includes(c.type)));
                    setEditExpComponents(car.components.filter((c: any) =>
                      ["cinture","cavi","estintore","serbatoio","passaporto"].includes(c.type))
                      .map((c: any) => ({ ...c, expiry: c.expiry_date || "" })));
                    setOpenEdit(true);
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded-lg flex items-center gap-2"
                >
                  <Edit size={16}/> Modifica
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: Modifica Auto */}
      {openEdit && editCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-3xl p-6">
            <h3 className="text-xl font-bold mb-4">Modifica Auto</h3>

            <label className="block text-sm mb-1">Nome auto</label>
            <input className="border rounded-lg p-2 w-full mb-3"
              value={editCar.name}
              onChange={(e) => setEditCar({ ...editCar, name: e.target.value })}/>

            <label className="block text-sm mb-1">Numero telaio</label>
            <input className="border rounded-lg p-2 w-full mb-3"
              value={editCar.chassis_number}
              onChange={(e) => setEditCar({ ...editCar, chassis_number: e.target.value })}/>

            <h4 className="font-semibold mt-4">Componenti base</h4>
            {editBaseComponents.map((b, idx) => (
              <input key={b.id} className="border rounded-lg p-2 w-full mb-2"
                value={b.identifier}
                onChange={(e) => {
                  const v = e.target.value;
                  setEditBaseComponents(prev =>
                    prev.map((x, i) => i === idx ? { ...x, identifier: v } : x)
                  );
                }}/>
            ))}

            <h4 className="font-semibold mt-4">Componenti con scadenza</h4>
            {editExpComponents.map((e, idx) => (
              <div key={e.id} className="flex gap-2 mb-2">
                <input className="border rounded-lg p-2 w-1/2"
                  value={e.identifier}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    setEditExpComponents(prev =>
                      prev.map((x, i) => i === idx ? { ...x, identifier: v } : x));
                  }}/>
                <input type="date" className="border rounded-lg p-2 w-1/2"
                  value={e.expiry}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    setEditExpComponents(prev =>
                      prev.map((x, i) => i === idx ? { ...x, expiry: v } : x));
                  }}/>
              </div>
            ))}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOpenEdit(false)}
                className="px-4 py-2 bg-gray-200 rounded-lg">Annulla</button>
              <button onClick={onUpdateCar}
                className="px-4 py-2 bg-yellow-500 rounded-lg font-bold text-black">
                Salva modifiche
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
