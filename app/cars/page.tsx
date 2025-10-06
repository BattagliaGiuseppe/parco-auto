"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Edit, Info, List, Grid, Search, FileText, Printer } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type ComponentBase = { type: string; identifier: string };
type ComponentExp = { type: string; identifier: string; expiry: string };
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

  // modal gestione auto
  const [openModal, setOpenModal] = useState(false);
  const [mode, setMode] = useState<"add" | "edit" | "view">("add");
  const currentMode = mode as string; // fix TS in JSX comparisons
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // campi form
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [baseComponents, setBaseComponents] = useState<ComponentBase[]>([]);
  const [expiringComponents, setExpiringComponents] = useState<ComponentExp[]>([]);

  // elenco globale componenti (per select)
  const [allComponents, setAllComponents] = useState<any[]>([]);
  // selezione per add/edit: per ogni tipo { selection: compId | "__new__", newIdentifier: string }
  const [editChoice, setEditChoice] = useState<
    Record<string, { selection: string; newIdentifier: string }>
  >({});

  // popup conferma per montare un componente già montato altrove
  const [confirmData, setConfirmData] = useState<{
    show: boolean;
    compId: string;
    compIdentifier: string;
    fromAuto: string | null;
    toAuto: string;
    carId: string;
    type: string;
  }>({
    show: false,
    compId: "",
    compIdentifier: "",
    fromAuto: null,
    toAuto: "",
    carId: "",
    type: "",
  });

  // toast di successo
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });
  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  };

  // --- FETCH DATI ---
  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select(
        "id, name, chassis_number, components(id, type, identifier, expiry_date, is_active)"
      )
      .order("id", { ascending: true });
    if (!error) setCars(data || []);
  };

  const fetchAllComponents = async () => {
    const { data, error } = await supabase
      .from("components")
      .select("id, type, identifier, expiry_date, car_id, car:car_id(name)")
      .order("id", { ascending: true });
    if (!error) setAllComponents(data || []);
  };

  useEffect(() => {
    fetchCars();
    fetchAllComponents();
  }, []);

  // reset form
  const resetForm = () => {
    setName("");
    setChassis("");
    setBaseComponents([
      { type: "motore", identifier: "" },
      { type: "cambio", identifier: "" },
      { type: "differenziale", identifier: "" },
    ]);
    setExpiringComponents([
      { type: "cinture", identifier: "", expiry: "" },
      { type: "cavi", identifier: "", expiry: "" },
      { type: "estintore", identifier: "", expiry: "" },
      { type: "serbatoio", identifier: "", expiry: "" },
      { type: "passaporto", identifier: "", expiry: "" },
    ]);
    setEditChoice({});
  };

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
    const comps = (car.components || []).filter((c: any) => c.type === searchBy);
    if (!search.trim()) return comps.length > 0;
    return comps.some((c: any) =>
      (c.identifier || "").toLowerCase().includes(search.toLowerCase())
    );
  });

  // montaggio con smontaggio automatico
  const mountComponent = async (carId: string, compId: string) => {
    if (!carId || !compId) return;

    const { data: selectedComp, error: compErr } = await supabase
      .from("components")
      .select("id, type, car_id")
      .eq("id", compId)
      .single();

    if (compErr || !selectedComp) return;

    // se montato su altra auto -> smonta
    if (selectedComp.car_id && selectedComp.car_id !== carId) {
      await supabase
        .from("components")
        .update({ car_id: null })
        .eq("id", selectedComp.id);
    }

    // smonta eventuale componente dello stesso tipo già presente su quest'auto
    const { data: existingComp } = await supabase
      .from("components")
      .select("id")
      .eq("car_id", carId)
      .eq("type", selectedComp.type)
      .single();
    if (existingComp) {
      await supabase
        .from("components")
        .update({ car_id: null })
        .eq("id", existingComp.id);
    }

    // monta
    await supabase.from("components").update({ car_id: carId }).eq("id", compId);
  };

  // salva nuova auto — supporta select (esistenti) o nuovo
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

      // BASE: motore, cambio, differenziale
      const baseTypes: ComponentType[] = ["motore", "cambio", "differenziale"];
      for (const type of baseTypes) {
        const choice = editChoice[type];
        if (choice?.selection && choice.selection !== "__new__") {
          // monta componente esistente (smontaggio automatico)
          await mountComponent(newCar.id, choice.selection);
        } else {
          // crea nuovo e monta
          const identifier =
            choice?.newIdentifier ||
            baseComponents.find((b) => b.type === type)?.identifier ||
            `${name} - ${defaultLabel[type]}`;
          await supabase
            .from("components")
            .insert([
              {
                type,
                identifier,
                car_id: newCar.id,
                is_active: true,
              },
            ]);
        }
      }

      // EXPIRE: altri componenti con scadenza
      const expireTypes: ComponentType[] = [
        "cinture",
        "cavi",
        "estintore",
        "serbatoio",
        "passaporto",
      ];
      for (const type of expireTypes) {
        const choice = editChoice[type];
        if (choice?.selection && choice.selection !== "__new__") {
          await mountComponent(newCar.id, choice.selection);
        } else {
          const e = expiringComponents.find((x) => x.type === type);
          const identifier =
            choice?.newIdentifier ||
            e?.identifier ||
            defaultLabel[type];
          const years = EXP_RULES[type as keyof typeof EXP_RULES] ?? 2;
          const expiry = e?.expiry || addYearsYYYYMMDD(years);
          await supabase
            .from("components")
            .insert([
              {
                type,
                identifier,
                car_id: newCar.id,
                expiry_date: expiry,
                is_active: true,
              },
            ]);
        }
      }

      setOpenModal(false);
      resetForm();
      await fetchAllComponents();
      await fetchCars();
    } catch (e) {
      console.error("Errore salvataggio auto:", e);
      alert("Errore nel salvataggio. Controlla la console.");
    } finally {
      setSaving(false);
    }
  };

  // aggiorna auto esistente — applica eventuali scelte di select
  const onUpdateCar = async () => {
    if (!selectedCar) return;
    setSaving(true);
    try {
      // 1) aggiorna dati auto
      const { error: carErr } = await supabase
        .from("cars")
        .update({ name, chassis_number: chassis })
        .eq("id", selectedCar.id);
      if (carErr) throw carErr;

      // 2) gestisci BASE
      for (const type of ["motore", "cambio", "differenziale"] as ComponentType[]) {
        const choice = editChoice[type];
        if (choice?.selection) {
          if (choice.selection === "__new__") {
            const identifier =
              choice.newIdentifier ||
              baseComponents.find((b) => b.type === type)?.identifier ||
              `${name} - ${defaultLabel[type]}`;
            const { data: created, error: insErr } = await supabase
              .from("components")
              .insert([{ type, identifier, is_active: true }])
              .select("id")
              .single();
            if (!insErr && created?.id) {
              await mountComponent(selectedCar.id, created.id);
            }
          } else {
            await mountComponent(selectedCar.id, choice.selection);
          }
        } else {
          // nessuna scelta: aggiorno solo identificativo esistente su quest’auto
          const curr = baseComponents.find((b) => b.type === type);
          if (curr?.identifier) {
            await supabase
              .from("components")
              .update({ identifier: curr.identifier })
              .eq("car_id", selectedCar.id)
              .eq("type", type);
          }
        }
      }

      // 3) gestisci EXPIRE
      for (const type of ["cinture", "cavi", "estintore", "serbatoio", "passaporto"] as ComponentType[]) {
        const choice = editChoice[type];
        if (choice?.selection) {
          if (choice.selection === "__new__") {
            const e = expiringComponents.find((x) => x.type === type);
            const years = EXP_RULES[type as keyof typeof EXP_RULES] ?? 2;
            const expiry = e?.expiry || addYearsYYYYMMDD(years);
            const identifier = choice.newIdentifier || e?.identifier || defaultLabel[type];
            const { data: created, error: insErr } = await supabase
              .from("components")
              .insert([{ type, identifier, expiry_date: expiry, is_active: true }])
              .select("id")
              .single();
            if (!insErr && created?.id) {
              await mountComponent(selectedCar.id, created.id);
            }
          } else {
            await mountComponent(selectedCar.id, choice.selection);
          }
        } else {
          // nessuna scelta: aggiorno i campi del componente attuale su quest’auto
          const e = expiringComponents.find((x) => x.type === type);
          if (e) {
            await supabase
              .from("components")
              .update({ identifier: e.identifier, expiry_date: e.expiry })
              .eq("car_id", selectedCar.id)
              .eq("type", type);
          }
        }
      }

      setOpenModal(false);
      resetForm();
      await fetchAllComponents();
      await fetchCars();
    } catch (e) {
      console.error("Errore aggiornamento auto:", e);
      alert("Errore nell'aggiornamento.");
    } finally {
      setSaving(false);
    }
  };

  // apri modali
  const openAdd = async () => {
    resetForm();
    await fetchAllComponents();
    setMode("add");
    setOpenModal(true);
  };

  const openEdit = async (car: any) => {
    setSelectedCar(car);
    setName(car.name);
    setChassis(car.chassis_number);

    setBaseComponents(
      (car.components || [])
        .filter((c: any) =>
          ["motore", "cambio", "differenziale"].includes(c.type)
        )
        .map((c: any) => ({ type: c.type, identifier: c.identifier }))
    );

    setExpiringComponents(
      (car.components || [])
        .filter(
          (c: any) => !["motore", "cambio", "differenziale"].includes(c.type)
        )
        .map((c: any) => ({
          type: c.type,
          identifier: c.identifier,
          expiry: c.expiry_date || "",
        }))
    );

    // default editChoice = componente attuale per ciascun tipo
    const nextChoice: Record<string, { selection: string; newIdentifier: string }> = {};
    (car.components || []).forEach((c: any) => {
      nextChoice[c.type] = { selection: c.id, newIdentifier: "" };
    });
    setEditChoice(nextChoice);

    await fetchAllComponents();
    setMode("edit");
    setOpenModal(true);
  };

  const openView = async (car: any) => {
    await openEdit(car);
    setMode("view");
  };

  // opzioni select per tipo
  const optionsForType = (type: string) => {
    const items = allComponents.filter((c) => c.type === type);
    const unassigned = items.filter((c) => !c.car_id);
    const assigned = items.filter((c) => c.car_id);
    return { unassigned, assigned };
  };

  // gestione cambio select
  const handleSelectChange = (type: string, value: string) => {
    // in add/edit memorizza scelta; se il comp è montato altrove -> popup
    if (currentMode === "view") return;

    if (value === "__new__") {
      setEditChoice((prev) => ({
        ...prev,
        [type]: { selection: "__new__", newIdentifier: "" },
      }));
      return;
    }
    if (!value) {
      setEditChoice((prev) => ({
        ...prev,
        [type]: { selection: "", newIdentifier: "" },
      }));
      return;
    }

    const comp = allComponents.find((c) => c.id === value);
    if (!comp) return;

    // Se montato su un’altra auto -> popup
    if (comp.car_id && comp.car?.name) {
      setConfirmData({
        show: true,
        compId: comp.id,
        compIdentifier: comp.identifier,
        fromAuto: comp.car?.name || null,
        toAuto: selectedCar ? selectedCar.name : name,
        carId: selectedCar ? selectedCar.id : "new",
        type,
      });
      // Non salvo subito la scelta; avverrà al confirm
      return;
    }

    // Se smontato, seleziono direttamente
    setEditChoice((prev) => ({
      ...prev,
      [type]: { selection: value, newIdentifier: "" },
    }));
  };

  // conferma montaggio da popup (per edit: monta subito; per add: memorizza scelta)
  const confirmMountNow = async () => {
    const { compId, carId, type } = confirmData;
    if (!compId || !type) {
      setConfirmData({
        show: false,
        compId: "",
        compIdentifier: "",
        fromAuto: null,
        toAuto: "",
        carId: "",
        type: "",
      });
      return;
    }

    if (currentMode === "edit" && carId && carId !== "new" && selectedCar) {
      // in edit, montiamo immediatamente
      await mountComponent(selectedCar.id, compId);
      await fetchAllComponents();
      await fetchCars();
      showToast("✅ Componente montato correttamente");
    }

    // In add, memorizziamo la scelta; il montaggio avverrà in onSaveCar dopo creazione dell’auto
    setEditChoice((prev) => ({
      ...prev,
      [type]: { selection: compId, newIdentifier: "" },
    }));

    setConfirmData({
      show: false,
      compId: "",
      compIdentifier: "",
      fromAuto: null,
      toAuto: "",
      carId: "",
      type: "",
    });
  };

  // --- UI ---
  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestione Auto</h1>
          <div className="mt-3">
            <Image
              src="/mia-foto.png"
              alt="La mia auto"
              width={960}
              height={480}
              priority
              className="rounded-xl w-full max-w-3xl h-auto"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          {/* Ricerca */}
          <div className="flex items-center border rounded-lg px-3 py-2 bg-white shadow-sm">
            <Search className="text-gray-500 mr-2" size={18} />
            <input
              type="text"
              placeholder={
                searchBy === "auto"
                  ? "Cerca per nome o telaio…"
                  : `Cerca per ${searchBy} (identificativo)…`
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="outline-none text-sm w-48 md:w-72"
            />
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value as any)}
              className="ml-2 text-sm border rounded px-2 py-1"
            >
              <option value="auto">Auto</option>
              {COMPONENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {capitalize(t)}
                </option>
              ))}
            </select>
          </div>

          {/* Switch vista */}
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

          {/* Aggiungi Auto */}
          <button
            onClick={openAdd}
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
                <span className="text-sm opacity-80">{car.chassis_number}</span>
              </div>
              {view === "sintetica" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(car)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Edit size={16} /> Modifica
                  </button>
                  <button
                    onClick={() => openView(car)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Info size={16} /> Dettagli
                  </button>
                </div>
              )}
            </div>

            <div className="p-4">
              {view === "dettagliata" ? (
                <>
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
                            {new Date(
                              comp.expiry_date
                            ).toLocaleDateString("it-IT")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-4 gap-2">
                    <button
                      onClick={() => openEdit(car)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded-lg flex items-center gap-2"
                    >
                      <Edit size={16} /> Modifica
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">—</p>
              )}
            </div>

            <div className="px-4 pb-4 flex justify-end gap-2">
              <Link
                href={`/cars/${car.id}/documents`}
                className="bg-gray-900 hover:bg-gray-800 text-yellow-500 px-3 py-2 rounded-lg flex items-center gap-2"
              >
                <FileText size={16} /> Documenti
              </Link>
              <Link
                href={`/cars/${car.id}/print`}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2"
              >
                <Printer size={16} /> Stampa
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL comune per Add/Edit/View */}
      {openModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => !saving && setOpenModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  {currentMode === "add"
                    ? "Aggiungi Auto"
                    : currentMode === "edit"
                    ? "Modifica Auto"
                    : "Dettagli Auto"}
                </h3>
                <button
                  onClick={() => !saving && setOpenModal(false)}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Dati auto */}
                <div className="space-y-3">
                  <label className="block text-sm text-gray-700">
                    Nome auto
                  </label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={currentMode === "view"}
                  />
                  <label className="block text-sm text-gray-700 mt-3">
                    Numero telaio
                  </label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={chassis}
                    onChange={(e) => setChassis(e.target.value)}
                    disabled={currentMode === "view"}
                  />
                </div>

                {/* Componenti base */}
                <div className="space-y-3">
                  <p className="font-semibold text-gray-800">Componenti base</p>
                  {(["motore", "cambio", "differenziale"] as ComponentType[]).map(
                    (type) => {
                      if (["edit", "add"].includes(currentMode)) {
                        const { unassigned, assigned } = optionsForType(type);
                        const currentSel =
                          editChoice[type]?.selection ??
                          selectedCar?.components?.find(
                            (c: any) => c.type === type
                          )?.id ??
                          "";
                        return (
                          <div key={type} className="space-y-1">
                            <span className="w-32 text-sm text-gray-600 capitalize block">
                              {type}
                            </span>
                            <select
                              className="border rounded-lg p-2 w-full"
                              value={currentSel}
                              onChange={(e) =>
                                handleSelectChange(type, e.target.value)
                              }
                              disabled={currentMode === "view"}
                            >
                              <option value="__new__">
                                ➕ Aggiungi nuovo componente…
                              </option>
                              {unassigned.length > 0 && (
                                <>
                                  <option disabled className="font-bold">
                                    — Smontati —
                                  </option>
                                  {unassigned.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.identifier} (smontato)
                                    </option>
                                  ))}
                                </>
                              )}
                              {assigned.length > 0 && (
                                <>
                                  <option disabled className="font-bold">
                                    — Montati —
                                  </option>
                                  {assigned.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.identifier} – Montato su:{" "}
                                      {c.car?.name || "—"}
                                    </option>
                                  ))}
                                </>
                              )}
                              {!currentSel && (
                                <option value="">— Seleziona —</option>
                              )}
                            </select>

                            {editChoice[type]?.selection === "__new__" && (
                              <input
                                className="border rounded-lg p-2 w-full mt-1"
                                placeholder={`Identificativo nuovo ${defaultLabel[type as ComponentType]}`}
                                value={editChoice[type]?.newIdentifier || ""}
                                onChange={(e) =>
                                  setEditChoice((prev) => ({
                                    ...prev,
                                    [type]: {
                                      selection: "__new__",
                                      newIdentifier: e.target.value,
                                    },
                                  }))
                                }
                                disabled={currentMode === "view"}
                              />
                            )}
                          </div>
                        );
                      }

                      // Solo vista
                      const curr = baseComponents.find((b) => b.type === type);
                      return (
                        <div key={type} className="flex items-center gap-2">
                          <span className="w-32 text-sm text-gray-600 capitalize">
                            {type}
                          </span>
                          <input
                            className="border rounded-lg p-2 w-full"
                            value={curr?.identifier || ""}
                            disabled
                          />
                        </div>
                      );
                    }
                  )}
                </div>

                {/* Componenti con scadenza */}
                <div className="md:col-span-2">
                  <p className="font-semibold text-gray-800 mb-2">
                    Componenti con scadenza
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(["cinture", "cavi", "estintore", "serbatoio", "passaporto"] as ComponentType[]).map(
                      (type) => {
                        const e = expiringComponents.find((x) => x.type === type);
                        if (["edit", "add"].includes(currentMode)) {
                          const { unassigned, assigned } = optionsForType(type);
                          const currentSel =
                            editChoice[type]?.selection ??
                            selectedCar?.components?.find(
                              (c: any) => c.type === type
                            )?.id ??
                            "";
                          return (
                            <div
                              key={type}
                              className="grid grid-cols-5 gap-2 items-center"
                            >
                              <span className="col-span-1 text-sm text-gray-600 capitalize">
                                {type}
                              </span>
                              <div className="col-span-2">
                                <select
                                  className="border rounded-lg p-2 w-full"
                                  value={currentSel}
                                  onChange={(ev) =>
                                    handleSelectChange(type, ev.target.value)
                                  }
                                  disabled={currentMode === "view"}
                                >
                                  <option value="__new__">
                                    ➕ Aggiungi nuovo componente…
                                  </option>
                                  {unassigned.length > 0 && (
                                    <>
                                      <option disabled className="font-bold">
                                        — Smontati —
                                      </option>
                                      {unassigned.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.identifier} (smontato)
                                        </option>
                                      ))}
                                    </>
                                  )}
                                  {assigned.length > 0 && (
                                    <>
                                      <option disabled className="font-bold">
                                        — Montati —
                                      </option>
                                      {assigned.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.identifier} – Montato su:{" "}
                                          {c.car?.name || "—"}
                                        </option>
                                      ))}
                                    </>
                                  )}
                                  {!currentSel && (
                                    <option value="">— Seleziona —</option>
                                  )}
                                </select>

                                {editChoice[type]?.selection === "__new__" && (
                                  <input
                                    className="border rounded-lg p-2 w-full mt-1"
                                    placeholder={`Identificativo nuovo ${defaultLabel[type as ComponentType]}`}
                                    value={editChoice[type]?.newIdentifier || ""}
                                    onChange={(ev) =>
                                      setEditChoice((prev) => ({
                                        ...prev,
                                        [type]: {
                                          selection: "__new__",
                                          newIdentifier: ev.target.value,
                                        },
                                      }))
                                    }
                                    disabled={currentMode === "view"}
                                  />
                                )}
                              </div>

                              {/* Campo scadenza */}
                              <input
                                type="date"
                                className="col-span-2 border rounded-lg p-2"
                                value={e?.expiry || ""}
                                onChange={(ev) => {
                                  const v = ev.target.value;
                                  setExpiringComponents((prev) =>
                                    prev.map((x) =>
                                      x.type === type ? { ...x, expiry: v } : x
                                    )
                                  );
                                }}
                                disabled={currentMode === "view"}
                              />
                            </div>
                          );
                        }

                        // View only
                        return (
                          <div
                            key={type}
                            className="grid grid-cols-5 gap-2 items-center"
                          >
                            <span className="col-span-1 text-sm text-gray-600 capitalize">
                              {type}
                            </span>
                            <input
                              className="col-span-2 border rounded-lg p-2"
                              value={e?.identifier || ""}
                              disabled
                            />
                            <input
                              type="date"
                              className="col-span-2 border rounded-lg p-2"
                              value={e?.expiry || ""}
                              disabled
                            />
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>

              {/* Footer della modale */}
              {currentMode !== "view" && (
                <div className="flex justify-end gap-3 px-6 py-4 border-t">
                  <button
                    onClick={() => setOpenModal(false)}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={currentMode === "add" ? onSaveCar : onUpdateCar}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                  >
                    {saving
                      ? "Salvataggio..."
                      : currentMode === "add"
                      ? "Salva auto"
                      : "Salva modifiche"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Popup conferma montaggio */}
      {confirmData.show && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Conferma cambio componente
            </h3>
            <p className="text-gray-700 mb-6">
              Vuoi smontare{" "}
              <span className="font-semibold">
                {confirmData.compIdentifier}
              </span>{" "}
              da{" "}
              <span className="font-semibold">{confirmData.fromAuto}</span> e
              montarlo su{" "}
              <span className="font-semibold">{confirmData.toAuto}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() =>
                  setConfirmData({
                    show: false,
                    compId: "",
                    compIdentifier: "",
                    fromAuto: null,
                    toAuto: "",
                    carId: "",
                    type: "",
                  })
                }
                className="px-4 py-2 rounded-lg border"
              >
                Annulla
              </button>
              <button
                onClick={confirmMountNow}
                className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast conferma */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-[70] bg-yellow-400 text-black font-semibold px-4 py-3 rounded-lg shadow-lg">
          {toast.message}
        </div>
      )}
    </div>
  );
}
