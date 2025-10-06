"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, PlusCircle, Search, Wrench } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type ComponentType =
  | "motore"
  | "cambio"
  | "differenziale"
  | "cinture"
  | "cavi"
  | "estintore"
  | "serbatoio"
  | "passaporto";

type Car = {
  id: string;
  name: string;
  chassis_number: string | null;
};

type ComponentRow = {
  id: string;
  type: ComponentType | string;
  identifier: string | null;
  expiry_date: string | null;
  is_active: boolean | null;
  last_maintenance_date: string | null;
  car_id: string | null;
  car?: { id: string; name: string | null; chassis_number: string | null } | null;
  // eventuali colonne possibili per ore lavoro
  work_hours?: number | null;
  hours_worked?: number | null;
  hours?: number | null;
};

const EXP_RULES: Partial<Record<ComponentType, number>> = {
  cinture: 5,
  cavi: 2,
  estintore: 2,
  serbatoio: 5,
  passaporto: 10,
};

const LABELS: Record<ComponentType, string> = {
  motore: "Motore",
  cambio: "Cambio",
  differenziale: "Differenziale",
  cinture: "Cinture di sicurezza",
  cavi: "Cavi ritenuta ruote",
  estintore: "Estintore",
  serbatoio: "Serbatoio carburante",
  passaporto: "Passaporto tecnico",
};

function capitalize(x: string) {
  return x.charAt(0).toUpperCase() + x.slice(1);
}
function addYearsYYYYMMDD(years: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}
function expiryColor(date: string) {
  const expiry = new Date(date);
  const now = new Date();
  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());
  if (months > 12) return "text-green-500";
  if (months > 6) return "text-yellow-500";
  return "text-red-500";
}

export default function ComponentsPage() {
  // data
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ComponentType>("all");
  const [carFilter, setCarFilter] = useState<"all" | "unassigned" | string>("all"); // string=car_id
  const [expiryFilter, setExpiryFilter] = useState<"all" | "expiring" | "expired">("all");

  // modals
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<ComponentRow | null>(null);

  const [showMountPicker, setShowMountPicker] = useState(false);
  const [mountComp, setMountComp] = useState<ComponentRow | null>(null);

  const [confirmReplace, setConfirmReplace] = useState<{
    show: boolean;
    compToMount: ComponentRow | null;
    targetCar: Car | null;
    existingComp: ComponentRow | null;
  }>({ show: false, compToMount: null, targetCar: null, existingComp: null });

  // toast
  const [toast, setToast] = useState<{ show: boolean; text: string }>({ show: false, text: "" });
  const showToast = (text: string) => {
    setToast({ show: true, text });
    setTimeout(() => setToast({ show: false, text: "" }), 1800);
  };

  // add/edit form state
  const [formType, setFormType] = useState<ComponentType>("motore");
  const [formIdentifier, setFormIdentifier] = useState("");
  const [formExpiry, setFormExpiry] = useState<string>("");

  // fetch
const fetchAll = async () => {
  setLoading(true);
  const [{ data: comps }, { data: carsData }] = await Promise.all([
    supabase
      .from("components")
      .select(`
        id,
        type,
        identifier,
        expiry_date,
        is_active,
        last_maintenance_date,
        car_id,
        work_hours,
        hours_worked,
        hours,
        car:car_id!inner (
          id,
          name,
          chassis_number
        )
      `)
      .order("id", { ascending: true }),
    supabase
      .from("cars")
      .select("id,name,chassis_number")
      .order("id", { ascending: true }),
  ]);

  // 🔧 Fix per evitare array vuoti o undefined
  setComponents(
    ((comps as any[])?.map((c) => ({
      ...c,
      car: Array.isArray(c.car) ? c.car[0] : c.car || null,
    })) || []) as ComponentRow[]
  );
  setCars((carsData as Car[]) || []);
  setLoading(false);
};
    setCars((carsData as Car[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    return components.filter((c) => {
      // text search
      const matchQ =
        !q ||
        (c.identifier || "").toLowerCase().includes(q.toLowerCase()) ||
        (c.type || "").toLowerCase().includes(q.toLowerCase()) ||
        (c.car?.name || "").toLowerCase().includes(q.toLowerCase());

      if (!matchQ) return false;

      // type filter
      if (typeFilter !== "all" && c.type !== typeFilter) return false;

      // car filter
      if (carFilter === "unassigned" && c.car_id) return false;
      if (carFilter !== "all" && carFilter !== "unassigned" && c.car_id !== carFilter) return false;

      // expiry filter
      if (expiryFilter !== "all" && c.expiry_date) {
        const exp = new Date(c.expiry_date);
        const now = new Date();
        const months =
          (exp.getFullYear() - now.getFullYear()) * 12 + (exp.getMonth() - now.getMonth());
        if (expiryFilter === "expiring" && !(months <= 6 && months >= 0)) return false;
        if (expiryFilter === "expired" && !(exp < now)) return false;
      }
      return true;
    });
  }, [components, q, typeFilter, carFilter, expiryFilter]);

  // --------- actions ---------
  const openAdd = () => {
    setFormType("motore");
    setFormIdentifier("");
    setFormExpiry("");
    setShowAdd(true);
  };

  const openEdit = (c: ComponentRow) => {
    setEditing(c);
    setFormType((c.type as ComponentType) || "motore");
    setFormIdentifier(c.identifier || "");
    setFormExpiry(c.expiry_date || "");
    setShowEdit(true);
  };

  const handleAdd = async () => {
    if (!formIdentifier.trim()) {
      alert("Inserisci un identificativo.");
      return;
    }
    const payload: any = {
      type: formType,
      identifier: formIdentifier.trim(),
      is_active: true,
      car_id: null, // creato smontato
    };
    if (formExpiry) payload.expiry_date = formExpiry;

    const { error } = await supabase.from("components").insert([payload]);
    if (error) {
      console.error(error);
      alert("Errore nel salvataggio.");
      return;
    }
    setShowAdd(false);
    showToast("✅ Componente aggiunto");
    await fetchAll();
  };

  const handleEdit = async () => {
    if (!editing) return;
    if (!formIdentifier.trim()) {
      alert("Inserisci un identificativo.");
      return;
    }
    const payload: any = {
      // type NON modificabile, in bold nell'UI
      identifier: formIdentifier.trim(),
    };
    // aggiorna eventuale data scadenza (solo se il tipo ha scadenza)
    const typeHasExpiry = !!EXP_RULES[formType as ComponentType] || formType === "passaporto";
    if (typeHasExpiry) payload.expiry_date = formExpiry || null;

    const { error } = await supabase.from("components").update(payload).eq("id", editing.id);
    if (error) {
      console.error(error);
      alert("Errore nell'aggiornamento.");
      return;
    }
    setShowEdit(false);
    setEditing(null);
    showToast("✅ Componente aggiornato");
    await fetchAll();
  };

  const handleSmonta = async (c: ComponentRow) => {
    if (!c.id || !c.car_id) return;
    const { error } = await supabase.from("components").update({ car_id: null }).eq("id", c.id);
    if (error) {
      console.error(error);
      alert("Errore nello smontaggio.");
      return;
    }
    showToast("✅ Componente smontato");
    await fetchAll();
  };

  // apertura popup Monta (unificato)
  const openMountPicker = (c: ComponentRow) => {
    setMountComp(c);
    setShowMountPicker(true);
  };

  // richiesta montaggio: verifica se l'auto ha già un comp dello stesso tipo
  const requestMountOnCar = async (car: Car) => {
    if (!mountComp) return;
    // cerca se su quest'auto è presente stesso tipo
    const { data: existing } = await supabase
      .from("components")
      .select("id,identifier,type,car_id")
      .eq("car_id", car.id)
      .eq("type", mountComp.type);
    const existingComp = (existing as ComponentRow[] | null)?.[0] || null;

    if (existingComp) {
      setConfirmReplace({
        show: true,
        compToMount: mountComp,
        targetCar: car,
        existingComp,
      });
    } else {
      // monta diretto
      await doMount(mountComp, car, null);
    }
  };

  const doMount = async (
    comp: ComponentRow,
    car: Car,
    existingComp: ComponentRow | null
  ) => {
    // se esiste un componente dello stesso tipo su quell'auto -> smontalo
    if (existingComp?.id) {
      const { error: u1 } = await supabase
        .from("components")
        .update({ car_id: null })
        .eq("id", existingComp.id);
      if (u1) {
        console.error(u1);
        alert("Errore nello smontare il componente esistente.");
        return;
      }
    }

    // monta questo componente
    const { error: u2 } = await supabase
      .from("components")
      .update({ car_id: car.id })
      .eq("id", comp.id);
    if (u2) {
      console.error(u2);
      alert("Errore nel montaggio.");
      return;
    }

    setShowMountPicker(false);
    setMountComp(null);
    setConfirmReplace({ show: false, compToMount: null, targetCar: null, existingComp: null });
    showToast(`✅ Montato su ${car.name}`);
    await fetchAll();
  };

  // conferma dalla modale "sostituisci"
  const confirmReplaceNow = async () => {
    if (!confirmReplace.compToMount || !confirmReplace.targetCar) return;
    await doMount(confirmReplace.compToMount, confirmReplace.targetCar, confirmReplace.existingComp);
  };

  // ore lavoro (fallback colonne)
  const workHours = (c: ComponentRow) =>
    c.work_hours ?? c.hours_worked ?? c.hours ?? 0;

  // UI helpers
  const TypeBadge: React.FC<{ type: string }> = ({ type }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
      {capitalize(type)}
    </span>
  );

  // RENDER
  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-black text-yellow-500 rounded-xl p-2">
            <Wrench size={20} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Componenti</h1>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Ricerca */}
          <div className="flex items-center border rounded-lg px-3 py-2 bg-white shadow-sm">
            <Search className="text-gray-500 mr-2" size={18} />
            <input
              type="text"
              placeholder="Cerca per tipo, identificativo o auto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="outline-none text-sm w-56 md:w-72"
            />
          </div>

          {/* Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
          >
            <option value="all">Tutti i tipi</option>
            {(
              [
                "motore",
                "cambio",
                "differenziale",
                "cinture",
                "cavi",
                "estintore",
                "serbatoio",
                "passaporto",
              ] as ComponentType[]
            ).map((t) => (
              <option key={t} value={t}>
                {capitalize(t)}
              </option>
            ))}
          </select>

          {/* Auto */}
          <select
            value={carFilter}
            onChange={(e) =>
              setCarFilter(
                e.target.value === "all"
                  ? "all"
                  : e.target.value === "unassigned"
                  ? "unassigned"
                  : e.target.value
              )
            }
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
          >
            <option value="all">Tutte le auto</option>
            <option value="unassigned">Smontati</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.name} {car.chassis_number ? `(${car.chassis_number})` : ""}
              </option>
            ))}
          </select>

          {/* Scadenze */}
          <select
            value={expiryFilter}
            onChange={(e) => setExpiryFilter(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
          >
            <option value="all">Scadenze: Tutti</option>
            <option value="expiring">In scadenza (≤ 6 mesi)</option>
            <option value="expired">Scaduti</option>
          </select>

          {/* Aggiungi componente */}
          <button
            onClick={openAdd}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <PlusCircle size={18} /> Aggiungi
          </button>
        </div>
      </div>

      {/* Lista componenti */}
      {loading ? (
        <p>Caricamento…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              {/* Header card */}
              <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
                <div className="flex flex-col">
                  <h2 className="text-lg font-bold capitalize">{c.type}</h2>
                  <span className="text-sm opacity-80">
                    {c.car?.name
                      ? `${c.car.name}${
                          c.car.chassis_number ? ` – ${c.car.chassis_number}` : ""
                        }`
                      : "— Smontato —"}
                  </span>
                </div>
                <div className="flex gap-2">
                  {c.car_id ? (
                    <button
                      onClick={() => handleSmonta(c)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg text-sm"
                    >
                      Smonta
                    </button>
                  ) : (
                    <button
                      onClick={() => openMountPicker(c)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-1.5 rounded-lg text-sm"
                    >
                      Monta
                    </button>
                  )}
                </div>
              </div>

              {/* Corpo card */}
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 text-sm font-semibold">
                    Identificativo:
                  </span>
                  <span className="text-gray-800 text-sm">
                    {c.identifier || "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-700 text-sm font-semibold">
                    Ore Lavoro:
                  </span>
                  <span className="text-gray-800 text-sm">{workHours(c)}</span>
                </div>

                {c.expiry_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 text-sm font-semibold">
                      Scadenza:
                    </span>
                    <span
                      className={`font-semibold ${expiryColor(c.expiry_date)}`}
                    >
                      {new Date(c.expiry_date).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                )}

                {c.last_maintenance_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 text-sm">
                      Ultima manutenzione:
                    </span>
                    <span className="font-semibold text-blue-600 text-sm">
                      {new Date(
                        c.last_maintenance_date
                      ).toLocaleDateString("it-IT")}
                    </span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => openEdit(c)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Edit size={16} /> Modifica
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-[80] bg-yellow-400 text-black font-semibold px-4 py-3 rounded-lg shadow-lg">
          {toast.text}
        </div>
      )}
    </div>
  );
}

      {/* MODAL: Aggiungi */}
      {showAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowAdd(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">Aggiungi componente</h3>
                <button onClick={() => setShowAdd(false)} className="p-2 rounded hover:bg-gray-100">✕</button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 font-semibold">Tipo</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const t = e.target.value as ComponentType;
                      setFormType(t);
                      // reset expiry se il tipo non richiede scadenza
                      if (!EXP_RULES[t] && t !== "passaporto") setFormExpiry("");
                    }}
                    className="border rounded-lg p-2 w-full"
                  >
                    {(
                      [
                        "motore",
                        "cambio",
                        "differenziale",
                        "cinture",
                        "cavi",
                        "estintore",
                        "serbatoio",
                        "passaporto",
                      ] as ComponentType[]
                    ).map((t) => (
                      <option key={t} value={t}>
                        {capitalize(t)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 font-semibold">Identificativo</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    placeholder="Es. Motore Pista #01"
                    value={formIdentifier}
                    onChange={(e) => setFormIdentifier(e.target.value)}
                  />
                </div>

                {(EXP_RULES[formType] || formType === "passaporto") && (
                  <div>
                    <label className="block text-sm text-gray-700 font-semibold">Scadenza</label>
                    <input
                      type="date"
                      className="border rounded-lg p-2 w-full"
                      value={formExpiry}
                      onChange={(e) => setFormExpiry(e.target.value)}
                    />
                    {!formExpiry && (
                      <p className="text-xs text-gray-500 mt-1">
                        Suggerimento: valore predefinito {EXP_RULES[formType as ComponentType] ?? 2} anni
                        ({addYearsYYYYMMDD(EXP_RULES[formType as ComponentType] ?? 2)})
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                >
                  Annulla
                </button>
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                >
                  Salva
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL: Modifica */}
      {showEdit && editing && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowEdit(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">Modifica componente</h3>
                <button onClick={() => setShowEdit(false)} className="p-2 rounded hover:bg-gray-100">✕</button>
              </div>

              <div className="p-6 space-y-4">
                {/* Tipo NON modificabile, in grassetto */}
                <div>
                  <label className="block text-sm text-gray-700 font-semibold">Tipo</label>
                  <div className="border rounded-lg p-2 w-full font-bold bg-gray-50">
                    {capitalize(formType)}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 font-semibold">Identificativo</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    placeholder="Identificativo"
                    value={formIdentifier}
                    onChange={(e) => setFormIdentifier(e.target.value)}
                  />
                </div>

                {(EXP_RULES[formType] || formType === "passaporto") && (
                  <div>
                    <label className="block text-sm text-gray-700 font-semibold">Scadenza</label>
                    <input
                      type="date"
                      className="border rounded-lg p-2 w-full"
                      value={formExpiry}
                      onChange={(e) => setFormExpiry(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={() => setShowEdit(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                >
                  Annulla
                </button>
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                >
                  Salva modifiche
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL: Seleziona Auto per Monta */}
      {showMountPicker && mountComp && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowMountPicker(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  Monta “{mountComp.identifier || capitalize(String(mountComp.type))}”
                </h3>
                <button onClick={() => setShowMountPicker(false)} className="p-2 rounded hover:bg-gray-100">
                  ✕
                </button>
              </div>

              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  Seleziona l’auto su cui montare il componente:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cars.map((car) => (
                    <button
                      key={car.id}
                      onClick={() => requestMountOnCar(car)}
                      className="w-full text-left border rounded-lg p-3 hover:bg-gray-50"
                    >
                      <div className="font-semibold">{car.name}</div>
                      <div className="text-sm text-gray-600">
                        {car.chassis_number || "—"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 border-t text-right">
                <button
                  onClick={() => setShowMountPicker(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL: Conferma sostituzione su auto scelta */}
      {confirmReplace.show && confirmReplace.targetCar && confirmReplace.compToMount && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={() => setConfirmReplace({ show: false, compToMount: null, targetCar: null, existingComp: null })}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Conferma sostituzione</h3>
              <p className="text-gray-700 mb-4">
                L’auto <span className="font-semibold">{confirmReplace.targetCar.name}</span>{" "}
                ha già un componente di tipo <span className="font-semibold">
                  {String(confirmReplace.compToMount.type).toLowerCase()}
                </span>.
              </p>
              <p className="text-gray-700 mb-6">
                Vuoi smontare quello esistente e montare{" "}
                <span className="font-semibold">{confirmReplace.compToMount.identifier || "il componente selezionato"}</span>{" "}
                su <span className="font-semibold">{confirmReplace.targetCar.name}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() =>
                    setConfirmReplace({ show: false, compToMount: null, targetCar: null, existingComp: null })
                  }
                  className="px-4 py-2 rounded-lg border"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmReplaceNow}
                  className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-[80] bg-yellow-400 text-black font-semibold px-4 py-3 rounded-lg shadow-lg">
          {toast.text}
        </div>
      )}
    </div>
  );
}
