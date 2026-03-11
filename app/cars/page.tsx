"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import {
  Edit,
  List,
  Grid,
  Search,
  FileText,
  Printer,
  CarFront,
  Wrench,
  Info,
} from "lucide-react";
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

type CarComponent = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  is_active: boolean | null;
  hours: number | null;
  life_hours: number | null;
  warning_threshold_hours: number | null;
  revision_threshold_hours: number | null;
  last_maintenance_date: string | null;
};

type CarRow = {
  id: string;
  name: string;
  chassis_number: string | null;
  hours: number | null;
  components: CarComponent[];
};

type GlobalComponent = {
  id: string;
  type: string;
  identifier: string;
  expiry_date: string | null;
  car_id: string | null;
  car: { name: string } | { name: string }[] | null;
};

type ComponentBase = { type: string; identifier: string };
type ComponentExp = { type: string; identifier: string; expiry: string };

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

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

function formatHours(value: number | null | undefined) {
  const totalMinutes = Math.round(Number(value ?? 0) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function getExpiryColor(date: string) {
  const expiry = new Date(date);
  const now = new Date();
  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  if (expiry < now) return "text-red-500";
  if (months > 12) return "text-green-500";
  if (months > 6) return "text-yellow-500";
  return "text-orange-500";
}

function getThresholdBadge(component: CarComponent) {
  const hours = Number(component.hours ?? 0);
  const warning = component.warning_threshold_hours;
  const revision = component.revision_threshold_hours;

  if (revision !== null && revision !== undefined && hours >= revision) {
    return {
      label: "Fuori soglia",
      className: "bg-red-100 text-red-700",
    };
  }

  if (warning !== null && warning !== undefined && hours >= warning) {
    return {
      label: "In attenzione",
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: "OK",
    className: "bg-green-100 text-green-700",
  };
}

function normalizeCarName(value: GlobalComponent["car"]) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0]?.name || null;
  return value.name || null;
}

export default function CarsPage() {
  const [cars, setCars] = useState<CarRow[]>([]);
  const [view, setView] = useState<"sintetica" | "dettagliata">("sintetica");

  const [search, setSearch] = useState("");
  const [searchBy, setSearchBy] = useState<"auto" | ComponentType>("auto");

  const [openModal, setOpenModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState<CarRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");
  const [baseComponents, setBaseComponents] = useState<ComponentBase[]>([]);
  const [expiringComponents, setExpiringComponents] = useState<ComponentExp[]>([]);

  const [allComponents, setAllComponents] = useState<GlobalComponent[]>([]);
  const [editChoice, setEditChoice] = useState<
    Record<string, { selection: string; newIdentifier: string }>
  >({});

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

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 2500);
  };

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

  const closeModal = () => {
    setOpenModal(false);
    setSelectedCar(null);
    resetForm();
  };

  const fetchCars = async () => {
    const { data, error } = await supabase
      .from("cars")
      .select(`
        id,
        name,
        chassis_number,
        hours,
        components (
          id,
          type,
          identifier,
          expiry_date,
          is_active,
          hours,
          life_hours,
          warning_threshold_hours,
          revision_threshold_hours,
          last_maintenance_date
        )
      `)
      .order("name", { ascending: true });

    if (!error) {
      const normalized: CarRow[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        chassis_number: row.chassis_number,
        hours: row.hours,
        components: (row.components || []) as CarComponent[],
      }));
      setCars(normalized);
    }
  };

  const fetchAllComponents = async () => {
    const { data, error } = await supabase
      .from("components")
      .select("id, type, identifier, expiry_date, car_id, car:car_id(name)")
      .order("identifier", { ascending: true });

    if (!error) {
      const normalized: GlobalComponent[] = (data || []).map((row: any) => ({
        id: row.id,
        type: row.type,
        identifier: row.identifier,
        expiry_date: row.expiry_date,
        car_id: row.car_id,
        car: row.car,
      }));
      setAllComponents(normalized);
    }
  };

  useEffect(() => {
    fetchCars();
    fetchAllComponents();
  }, []);

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      if (searchBy === "auto") {
        if (!search.trim()) return true;
        return (
          (car.name || "").toLowerCase().includes(search.toLowerCase()) ||
          (car.chassis_number || "").toLowerCase().includes(search.toLowerCase())
        );
      }

      const comps = (car.components || []).filter((c) => c.type === searchBy);
      if (!search.trim()) return comps.length > 0;

      return comps.some((c) =>
        (c.identifier || "").toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [cars, search, searchBy]);

  const mountComponent = async (carId: string, compId: string) => {
    if (!carId || !compId) return;

    const { error } = await supabase.rpc("mount_component", {
      p_car_id: carId,
      p_component_id: compId,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const createComponent = async (
    type: ComponentType,
    identifier: string,
    expiryDate?: string
  ) => {
    const { data, error } = await supabase
      .from("components")
      .insert([
        {
          type,
          identifier,
          expiry_date: expiryDate || null,
          is_active: true,
        },
      ])
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || "Errore creazione componente");
    }

    return data.id as string;
  };

  const onSaveCar = async () => {
    if (!name.trim() || !chassis.trim()) return;
    setSaving(true);

    try {
      const { data: newCar, error: carErr } = await supabase
        .from("cars")
        .insert([{ name, chassis_number: chassis }])
        .select()
        .single();

      if (carErr || !newCar?.id) throw carErr || new Error("Errore creazione auto");

      const baseTypes: ComponentType[] = ["motore", "cambio", "differenziale"];
      for (const type of baseTypes) {
        const choice = editChoice[type];

        if (choice?.selection && choice.selection !== "__new__") {
          await mountComponent(newCar.id, choice.selection);
        } else {
          const identifier =
            choice?.newIdentifier ||
            baseComponents.find((b) => b.type === type)?.identifier ||
            `${name} - ${defaultLabel[type]}`;

          const newComponentId = await createComponent(type, identifier);
          await mountComponent(newCar.id, newComponentId);
        }
      }

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
          const identifier = choice?.newIdentifier || e?.identifier || defaultLabel[type];
          const years = EXP_RULES[type as keyof typeof EXP_RULES] ?? 2;
          const expiry = e?.expiry || addYearsYYYYMMDD(years);

          const newComponentId = await createComponent(type, identifier, expiry);
          await mountComponent(newCar.id, newComponentId);
        }
      }

      showToast("✅ Auto creata correttamente");
      closeModal();
      await fetchAllComponents();
      await fetchCars();
    } catch (e: any) {
      console.error("Errore salvataggio auto:", e);
      showToast(`Errore salvataggio auto: ${e.message || "sconosciuto"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const onUpdateCar = async () => {
    if (!selectedCar) return;
    setSaving(true);

    try {
      const { error: carErr } = await supabase
        .from("cars")
        .update({ name, chassis_number: chassis })
        .eq("id", selectedCar.id);

      if (carErr) throw carErr;

      for (const type of ["motore", "cambio", "differenziale"] as ComponentType[]) {
        const choice = editChoice[type];
        const currentComponent = selectedCar.components?.find((c) => c.type === type);

        if (choice?.selection) {
          if (choice.selection === "__new__") {
            const identifier =
              choice.newIdentifier ||
              baseComponents.find((b) => b.type === type)?.identifier ||
              `${name} - ${defaultLabel[type]}`;

            const createdId = await createComponent(type, identifier);
            await mountComponent(selectedCar.id, createdId);
          } else if (choice.selection !== currentComponent?.id) {
            await mountComponent(selectedCar.id, choice.selection);
          }
        } else {
          const curr = baseComponents.find((b) => b.type === type);
          if (curr?.identifier && currentComponent?.id) {
            await supabase
              .from("components")
              .update({ identifier: curr.identifier })
              .eq("id", currentComponent.id);
          }
        }
      }

      for (const type of [
        "cinture",
        "cavi",
        "estintore",
        "serbatoio",
        "passaporto",
      ] as ComponentType[]) {
        const choice = editChoice[type];
        const currentComponent = selectedCar.components?.find((c) => c.type === type);

        if (choice?.selection) {
          if (choice.selection === "__new__") {
            const e = expiringComponents.find((x) => x.type === type);
            const years = EXP_RULES[type as keyof typeof EXP_RULES] ?? 2;
            const expiry = e?.expiry || addYearsYYYYMMDD(years);
            const identifier = choice.newIdentifier || e?.identifier || defaultLabel[type];

            const createdId = await createComponent(type, identifier, expiry);
            await mountComponent(selectedCar.id, createdId);
          } else if (choice.selection !== currentComponent?.id) {
            await mountComponent(selectedCar.id, choice.selection);
          }
        } else {
          const e = expiringComponents.find((x) => x.type === type);
          if (e && currentComponent?.id) {
            await supabase
              .from("components")
              .update({ identifier: e.identifier, expiry_date: e.expiry || null })
              .eq("id", currentComponent.id);
          }
        }
      }

      showToast("✅ Auto aggiornata correttamente");
      closeModal();
      await fetchAllComponents();
      await fetchCars();
    } catch (e: any) {
      console.error("Errore aggiornamento auto:", e);
      showToast(`Errore aggiornamento auto: ${e.message || "sconosciuto"}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const openAdd = async () => {
    resetForm();
    await fetchAllComponents();
    setSelectedCar(null);
    setOpenModal(true);
  };

  const openEdit = async (car: CarRow) => {
    setSelectedCar(car);
    setName(car.name);
    setChassis(car.chassis_number || "");

    setBaseComponents(
      (car.components || [])
        .filter((c) => ["motore", "cambio", "differenziale"].includes(c.type))
        .map((c) => ({ type: c.type, identifier: c.identifier }))
    );

    setExpiringComponents(
      (car.components || [])
        .filter((c) => !["motore", "cambio", "differenziale"].includes(c.type))
        .map((c) => ({
          type: c.type,
          identifier: c.identifier,
          expiry: c.expiry_date || "",
        }))
    );

    const nextChoice: Record<string, { selection: string; newIdentifier: string }> = {};
    (car.components || []).forEach((c) => {
      nextChoice[c.type] = { selection: c.id, newIdentifier: "" };
    });
    setEditChoice(nextChoice);

    await fetchAllComponents();
    setOpenModal(true);
  };

  const optionsForType = (type: string) => {
    const items = allComponents.filter((c) => c.type === type);
    const unassigned = items.filter((c) => !c.car_id);
    const assigned = items.filter((c) => c.car_id);
    return { unassigned, assigned };
  };

  const handleSelectChange = (type: string, value: string) => {
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

    const fromAuto = normalizeCarName(comp.car);

    if (comp.car_id && fromAuto) {
      setConfirmData({
        show: true,
        compId: comp.id,
        compIdentifier: comp.identifier,
        fromAuto,
        toAuto: selectedCar ? selectedCar.name : name,
        carId: selectedCar ? selectedCar.id : "new",
        type,
      });
      return;
    }

    setEditChoice((prev) => ({
      ...prev,
      [type]: { selection: value, newIdentifier: "" },
    }));
  };

  const confirmMountNow = async () => {
    const { compId, type } = confirmData;

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

    if (selectedCar) {
      try {
        await mountComponent(selectedCar.id, compId);
        await fetchAllComponents();
        await fetchCars();
        showToast("✅ Componente montato correttamente");
      } catch (e: any) {
        showToast(`Errore montaggio componente: ${e.message}`, "error");
      }
    }

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

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
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
              onChange={(e) => setSearchBy(e.target.value as "auto" | ComponentType)}
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

          <button
            onClick={() => setView(view === "sintetica" ? "dettagliata" : "sintetica")}
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
            onClick={openAdd}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg"
          >
            + Aggiungi Auto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCars.map((car) => {
          const criticalComponents = (car.components || []).filter((component) => {
            const badge = getThresholdBadge(component);
            return badge.label !== "OK";
          }).length;

          return (
            <div
              key={car.id}
              className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-start gap-3">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <CarFront size={18} />
                    {car.name}
                  </h2>
                  <span className="text-sm opacity-80">{car.chassis_number || "—"}</span>
                </div>

                <div className="flex gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => openEdit(car)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Edit size={16} /> Modifica
                  </button>

                  <Link
                    href={`/cars/${car.id}`}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-2 rounded-lg flex items-center gap-2"
                  >
                    <Info size={16} /> Dettagli
                  </Link>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-xl p-3 border">
                    <div className="text-gray-500">Ore auto</div>
                    <div className="font-bold text-gray-900">{formatHours(car.hours)}</div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 border">
                    <div className="text-gray-500">Componenti</div>
                    <div className="font-bold text-gray-900">{car.components?.length || 0}</div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3 border">
                    <div className="text-gray-500">Da controllare</div>
                    <div className="font-bold text-gray-900">{criticalComponents}</div>
                  </div>
                </div>

                {view === "dettagliata" ? (
                  <>
                    {car.components?.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {car.components.map((comp) => {
                          const badge = getThresholdBadge(comp);

                          return (
                            <div
                              key={comp.id}
                              className="bg-gray-50 px-3 py-3 rounded-xl border border-gray-200"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-sm text-gray-900">
                                    {comp.type} – {comp.identifier}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Ore attuali: {formatHours(comp.hours)} | Ore vita:{" "}
                                    {formatHours(comp.life_hours)}
                                  </div>
                                </div>

                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                                <span>
                                  Soglia attenzione:{" "}
                                  {comp.warning_threshold_hours !== null &&
                                  comp.warning_threshold_hours !== undefined
                                    ? formatHours(comp.warning_threshold_hours)
                                    : "—"}
                                </span>

                                <span>
                                  Soglia revisione:{" "}
                                  {comp.revision_threshold_hours !== null &&
                                  comp.revision_threshold_hours !== undefined
                                    ? formatHours(comp.revision_threshold_hours)
                                    : "—"}
                                </span>

                                {comp.expiry_date && (
                                  <span className={getExpiryColor(comp.expiry_date)}>
                                    Scadenza:{" "}
                                    {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Nessun componente montato su questa auto.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <Wrench size={15} className="text-yellow-500" />
                    <span>
                      {car.components?.length || 0} componenti montati • {criticalComponents} da
                      controllare
                    </span>
                  </div>
                )}
              </div>

              <div className="px-4 pb-4 flex justify-end gap-2 flex-wrap">
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
          );
        })}
      </div>

      {openModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => !saving && closeModal()}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-xl font-bold text-gray-800">
                  {selectedCar ? "Modifica Auto" : "Aggiungi Auto"}
                </h3>
                <button
                  onClick={() => !saving && closeModal()}
                  className="p-2 rounded hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-sm text-gray-700">Nome auto</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />

                  <label className="block text-sm text-gray-700 mt-3">Numero telaio</label>
                  <input
                    className="border rounded-lg p-2 w-full"
                    value={chassis}
                    onChange={(e) => setChassis(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <p className="font-semibold text-gray-800">Componenti base</p>
                  {(["motore", "cambio", "differenziale"] as ComponentType[]).map((type) => {
                    const { unassigned, assigned } = optionsForType(type);
                    const currentSel =
                      editChoice[type]?.selection ??
                      selectedCar?.components?.find((c) => c.type === type)?.id ??
                      "";

                    return (
                      <div key={type} className="space-y-1">
                        <span className="w-32 text-sm text-gray-600 capitalize block">
                          {type}
                        </span>

                        <select
                          className="border rounded-lg p-2 w-full"
                          value={currentSel}
                          onChange={(e) => handleSelectChange(type, e.target.value)}
                        >
                          <option value="__new__">➕ Aggiungi nuovo componente…</option>

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
                                  {c.identifier} – Montato su: {normalizeCarName(c.car) || "—"}
                                </option>
                              ))}
                            </>
                          )}

                          {!currentSel && <option value="">— Seleziona —</option>}
                        </select>

                        {editChoice[type]?.selection === "__new__" && (
                          <input
                            className="border rounded-lg p-2 w-full mt-1"
                            placeholder={`Identificativo nuovo ${defaultLabel[type]}`}
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
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="md:col-span-2">
                  <p className="font-semibold text-gray-800 mb-2">Componenti con scadenza</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(
                      ["cinture", "cavi", "estintore", "serbatoio", "passaporto"] as ComponentType[]
                    ).map((type) => {
                      const e = expiringComponents.find((x) => x.type === type);
                      const { unassigned, assigned } = optionsForType(type);
                      const currentSel =
                        editChoice[type]?.selection ??
                        selectedCar?.components?.find((c) => c.type === type)?.id ??
                        "";

                      return (
                        <div key={type} className="grid grid-cols-5 gap-2 items-center">
                          <span className="col-span-1 text-sm text-gray-600 capitalize">
                            {type}
                          </span>

                          <div className="col-span-2">
                            <select
                              className="border rounded-lg p-2 w-full"
                              value={currentSel}
                              onChange={(ev) => handleSelectChange(type, ev.target.value)}
                            >
                              <option value="__new__">➕ Aggiungi nuovo componente…</option>

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
                                      {c.identifier} – Montato su: {normalizeCarName(c.car) || "—"}
                                    </option>
                                  ))}
                                </>
                              )}

                              {!currentSel && <option value="">— Seleziona —</option>}
                            </select>

                            {editChoice[type]?.selection === "__new__" && (
                              <input
                                className="border rounded-lg p-2 w-full mt-1"
                                placeholder={`Identificativo nuovo ${defaultLabel[type]}`}
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
                              />
                            )}
                          </div>

                          <input
                            type="date"
                            className="col-span-2 border rounded-lg p-2"
                            value={e?.expiry || ""}
                            onChange={(ev) => {
                              const v = ev.target.value;
                              setExpiringComponents((prev) =>
                                prev.map((x) => (x.type === type ? { ...x, expiry: v } : x))
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t">
                <button
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
                >
                  Annulla
                </button>
                <button
                  onClick={selectedCar ? onUpdateCar : onSaveCar}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                >
                  {saving ? "Salvataggio..." : selectedCar ? "Salva modifiche" : "Salva auto"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {confirmData.show && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Conferma cambio componente
            </h3>
            <p className="text-gray-700 mb-6">
              Vuoi smontare{" "}
              <span className="font-semibold">{confirmData.compIdentifier}</span> da{" "}
              <span className="font-semibold">{confirmData.fromAuto}</span> e montarlo su{" "}
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

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[70] font-semibold px-4 py-3 rounded-lg shadow-lg ${
            toast.type === "success"
              ? "bg-yellow-400 text-black"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
