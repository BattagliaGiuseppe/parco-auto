"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
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
  PlusCircle,
  GaugeCircle,
  TriangleAlert,
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

  if (expiry < now) return "text-red-600";
  if (months > 12) return "text-green-700";
  if (months > 6) return "text-yellow-700";
  return "text-orange-600";
}

function getExpiryBadge(date: string) {
  const expiry = new Date(date);
  const now = new Date();
  const months =
    (expiry.getFullYear() - now.getFullYear()) * 12 +
    (expiry.getMonth() - now.getMonth());

  if (expiry < now) {
    return {
      label: "Scaduto",
      className: "bg-red-100 text-red-700",
    };
  }

  if (months <= 6) {
    return {
      label: "In scadenza",
      className: "bg-yellow-100 text-yellow-800",
    };
  }

  return {
    label: "Valido",
    className: "bg-green-100 text-green-700",
  };
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
      className: "bg-yellow-100 text-yellow-800",
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

  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 2200);
  };

  const fetchCars = async () => {
  const ctx = await getCurrentTeamContext();

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
    .eq("team_id", ctx.teamId)
    .order("id", { ascending: true });

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
  const ctx = await getCurrentTeamContext();

  const { data, error } = await supabase
    .from("components")
    .select("id, type, identifier, expiry_date, car_id, car:car_id(name)")
    .eq("team_id", ctx.teamId)
    .order("id", { ascending: true });

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

  const totalCars = cars.length;
  const totalComponentsMounted = useMemo(
    () => cars.reduce((acc, car) => acc + (car.components?.length || 0), 0),
    [cars]
  );
  const totalCriticalComponents = useMemo(
    () =>
      cars.reduce((acc, car) => {
        const count = (car.components || []).filter((component) => {
          const badge = getThresholdBadge(component);
          return badge.label !== "OK";
        }).length;
        return acc + count;
      }, 0),
    [cars]
  );

  const mountComponent = async (carId: string, compId: string) => {
  if (!carId || !compId) return;

  const ctx = await getCurrentTeamContext();

  const { data: selectedComp, error: compErr } = await supabase
    .from("components")
    .select("id, type, car_id")
    .eq("id", compId)
    .eq("team_id", ctx.teamId)
    .single();

    if (compErr || !selectedComp) return;

    if (selectedComp.car_id && selectedComp.car_id !== carId) {
      await supabase
  .from("components")
  .update({ car_id: null })
  .eq("id", selectedComp.id)
  .eq("team_id", ctx.teamId);

    const { data: existingComp } = await supabase
  .from("components")
  .select("id")
  .eq("car_id", carId)
  .eq("type", selectedComp.type)
  .eq("team_id", ctx.teamId)
  .single();

    if (existingComp) {
      await supabase
  .from("components")
  .update({ car_id: null })
  .eq("id", existingComp.id)
  .eq("team_id", ctx.teamId);

    await supabase
  .from("components")
  .update({ car_id: carId })
  .eq("id", compId)
  .eq("team_id", ctx.teamId);

  const onSaveCar = async () => {
    if (!name.trim() || !chassis.trim()) return;
    setSaving(true);

    try {
      const ctx = await getCurrentTeamContext();

const { data: newCar, error: carErr } = await supabase
  .from("cars")
  .insert([
    {
      team_id: ctx.teamId,
      name,
      chassis_number: chassis,
    },
  ])
  .select()
  .single();

      if (carErr) throw carErr;

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

          await supabase.from("components").insert([
  {
    team_id: ctx.teamId,
    type,
    identifier,
    car_id: newCar.id,
              is_active: true,
            },
          ]);
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

          await supabase.from("components").insert([
  {
    team_id: ctx.teamId,
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
      showToast("Auto salvata correttamente");
    } catch (e) {
      console.error("Errore salvataggio auto:", e);
      alert("Errore nel salvataggio. Controlla la console.");
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

      for (const type of [
        "cinture",
        "cavi",
        "estintore",
        "serbatoio",
        "passaporto",
      ] as ComponentType[]) {
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
      showToast("Auto aggiornata correttamente");
    } catch (e) {
      console.error("Errore aggiornamento auto:", e);
      alert("Errore nell'aggiornamento.");
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
      await mountComponent(selectedCar.id, compId);
      await fetchAllComponents();
      await fetchCars();
      showToast("Componente montato correttamente");
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
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <CarFront size={14} />
                Gestione Auto
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Parco auto racing
              </h1>

              <p className="mt-2 max-w-3xl text-sm text-yellow-100/75 leading-relaxed">
                Controlla le vetture, i componenti montati, le scadenze e lo stato tecnico
                generale in un’unica schermata.
              </p>
            </div>

            <div className="w-full xl:w-auto">
              <div className="rounded-2xl bg-white/5 border border-yellow-500/10 p-2">
                <Image
                  src="/mia-foto.png"
                  alt="La mia auto"
                  width={960}
                  height={480}
                  priority
                  className="rounded-xl w-full xl:w-[420px] h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <SummaryCard
              icon={<CarFront size={18} className="text-yellow-600" />}
              label="Auto totali"
              value={String(totalCars)}
            />
            <SummaryCard
              icon={<Wrench size={18} className="text-yellow-600" />}
              label="Componenti montati"
              value={String(totalComponentsMounted)}
            />
            <SummaryCard
              icon={<TriangleAlert size={18} className="text-yellow-600" />}
              label="Da controllare"
              value={String(totalCriticalComponents)}
              valueClassName={totalCriticalComponents > 0 ? "text-red-700" : "text-green-700"}
            />
            <SummaryCard
              icon={<GaugeCircle size={18} className="text-yellow-600" />}
              label="Vista attiva"
              value={view === "sintetica" ? "Sintetica" : "Dettagliata"}
            />
          </div>
        </div>
      </section>

      <section className="card-base p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center flex-1">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                placeholder={
                  searchBy === "auto"
                    ? "Cerca per nome auto o numero telaio..."
                    : `Cerca per ${searchBy}...`
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-3 py-3 text-sm"
              />
            </div>

            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value as "auto" | ComponentType)}
              className="rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm"
            >
              <option value="auto">Auto</option>
              {COMPONENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {capitalize(t)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setView(view === "sintetica" ? "dettagliata" : "sintetica")}
              className="btn-secondary"
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

            <button onClick={openAdd} className="btn-primary">
              <PlusCircle size={18} /> Aggiungi auto
            </button>
          </div>
        </div>
      </section>

      <section>
        {filteredCars.length === 0 ? (
          <div className="card-base p-10 text-center text-neutral-500">
            Nessuna auto trovata con i filtri attuali.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
            {filteredCars.map((car) => {
              const criticalComponents = (car.components || []).filter((component) => {
                const badge = getThresholdBadge(component);
                return badge.label !== "OK";
              }).length;

              return (
                <article
                  key={car.id}
                  className="card-base overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="bg-black text-yellow-500 px-4 py-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CarFront size={18} />
                        <h2 className="text-lg font-bold truncate">{car.name}</h2>
                      </div>
                      <div className="mt-1 text-sm text-yellow-100/75">
                        Telaio: {car.chassis_number || "—"}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => openEdit(car)} className="btn-primary !px-3 !py-2 !rounded-lg">
                        <Edit size={16} /> Modifica
                      </button>

                      <Link
                        href={`/cars/${car.id}`}
                        className="btn-secondary !px-3 !py-2 !rounded-lg"
                      >
                        <Info size={16} /> Dettagli
                      </Link>
                    </div>
                  </div>

                  <div className="p-4 md:p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <MiniStatCard
                        label="Ore auto"
                        value={formatHours(car.hours)}
                        icon={<GaugeCircle size={16} className="text-yellow-600" />}
                      />
                      <MiniStatCard
                        label="Componenti"
                        value={String(car.components?.length || 0)}
                        icon={<Wrench size={16} className="text-yellow-600" />}
                      />
                      <MiniStatCard
                        label="Criticità"
                        value={String(criticalComponents)}
                        valueClassName={criticalComponents > 0 ? "text-red-700" : "text-green-700"}
                        icon={<TriangleAlert size={16} className="text-yellow-600" />}
                      />
                    </div>

                    {view === "dettagliata" ? (
                      <>
                        {car.components?.length > 0 ? (
                          <div className="flex flex-col gap-3">
                            {car.components.map((comp) => {
                              const badge = getThresholdBadge(comp);
                              const expiryBadge =
                                comp.expiry_date ? getExpiryBadge(comp.expiry_date) : null;

                              return (
                                <div
                                  key={comp.id}
                                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                                >
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0">
                                      <div className="font-bold text-sm text-neutral-900">
                                        {capitalize(comp.type)} – {comp.identifier}
                                      </div>

                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <span
                                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                                        >
                                          {badge.label}
                                        </span>

                                        {expiryBadge && (
                                          <span
                                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${expiryBadge.className}`}
                                          >
                                            {expiryBadge.label}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                                    <InfoRow label="Ore attuali" value={formatHours(comp.hours)} />
                                    <InfoRow label="Ore vita" value={formatHours(comp.life_hours)} />
                                    <InfoRow
                                      label="Soglia attenzione"
                                      value={
                                        comp.warning_threshold_hours !== null &&
                                        comp.warning_threshold_hours !== undefined
                                          ? formatHours(comp.warning_threshold_hours)
                                          : "—"
                                      }
                                    />
                                    <InfoRow
                                      label="Soglia revisione"
                                      value={
                                        comp.revision_threshold_hours !== null &&
                                        comp.revision_threshold_hours !== undefined
                                          ? formatHours(comp.revision_threshold_hours)
                                          : "—"
                                      }
                                    />
                                  </div>

                                  {comp.expiry_date && (
                                    <div className="mt-3 text-sm">
                                      <span className="text-neutral-500">Scadenza: </span>
                                      <span className={getExpiryColor(comp.expiry_date)}>
                                        {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-500 text-center">
                            Nessun componente montato su questa auto.
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600 flex items-center gap-2">
                        <Wrench size={15} className="text-yellow-500" />
                        <span>
                          {car.components?.length || 0} componenti montati • {criticalComponents} da
                          controllare
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="px-4 pb-4 md:px-5 md:pb-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
                    <Link
                      href={`/cars/${car.id}/documents`}
                      className="btn-dark !px-3 !py-2 !rounded-lg"
                    >
                      <FileText size={16} /> Documenti
                    </Link>

                    <Link
                      href={`/cars/${car.id}/print`}
                      className="btn-secondary !px-3 !py-2 !rounded-lg"
                    >
                      <Printer size={16} /> Stampa
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {openModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={() => !saving && setOpenModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b bg-black text-yellow-400">
                <h3 className="text-xl font-bold">
                  {selectedCar ? "Modifica Auto" : "Aggiungi Auto"}
                </h3>
                <button
                  onClick={() => !saving && setOpenModal(false)}
                  className="rounded-lg px-3 py-1 text-yellow-300 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <h4 className="font-bold text-neutral-800 mb-4">Dati auto</h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-neutral-700 font-semibold mb-1">
                          Nome auto
                        </label>
                        <input
                          className="border rounded-xl p-3 w-full bg-white"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-neutral-700 font-semibold mb-1">
                          Numero telaio
                        </label>
                        <input
                          className="border rounded-xl p-3 w-full bg-white"
                          value={chassis}
                          onChange={(e) => setChassis(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <h4 className="font-bold text-neutral-800 mb-4">Componenti base</h4>

                    <div className="space-y-4">
                      {(["motore", "cambio", "differenziale"] as ComponentType[]).map((type) => {
                        const { unassigned, assigned } = optionsForType(type);
                        const currentSel =
                          editChoice[type]?.selection ??
                          selectedCar?.components?.find((c) => c.type === type)?.id ??
                          "";

                        return (
                          <div key={type} className="space-y-2">
                            <span className="text-sm text-neutral-700 font-semibold block capitalize">
                              {type}
                            </span>

                            <select
                              className="border rounded-xl p-3 w-full bg-white"
                              value={currentSel}
                              onChange={(e) => handleSelectChange(type, e.target.value)}
                            >
                              <option value="__new__">➕ Aggiungi nuovo componente…</option>

                              {unassigned.length > 0 && (
                                <>
                                  <option disabled>— Smontati —</option>
                                  {unassigned.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.identifier} (smontato)
                                    </option>
                                  ))}
                                </>
                              )}

                              {assigned.length > 0 && (
                                <>
                                  <option disabled>— Montati —</option>
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
                                className="border rounded-xl p-3 w-full bg-white"
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
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <h4 className="font-bold text-neutral-800 mb-4">Componenti con scadenza</h4>

                  <div className="space-y-4">
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
                        <div key={type} className="rounded-xl border border-neutral-200 bg-white p-3">
                          <span className="text-sm text-neutral-700 font-semibold capitalize block mb-2">
                            {type}
                          </span>

                          <div className="grid grid-cols-1 gap-3">
                            <select
                              className="border rounded-xl p-3 w-full bg-white"
                              value={currentSel}
                              onChange={(ev) => handleSelectChange(type, ev.target.value)}
                            >
                              <option value="__new__">➕ Aggiungi nuovo componente…</option>

                              {unassigned.length > 0 && (
                                <>
                                  <option disabled>— Smontati —</option>
                                  {unassigned.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.identifier} (smontato)
                                    </option>
                                  ))}
                                </>
                              )}

                              {assigned.length > 0 && (
                                <>
                                  <option disabled>— Montati —</option>
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
                                className="border rounded-xl p-3 w-full bg-white"
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

                            <input
                              type="date"
                              className="border rounded-xl p-3 w-full bg-white"
                              value={e?.expiry || ""}
                              onChange={(ev) => {
                                const v = ev.target.value;
                                setExpiringComponents((prev) =>
                                  prev.map((x) => (x.type === type ? { ...x, expiry: v } : x))
                                );
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-white">
                <button
                  onClick={() => setOpenModal(false)}
                  disabled={saving}
                  className="btn-secondary"
                >
                  Annulla
                </button>
                <button
                  onClick={selectedCar ? onUpdateCar : onSaveCar}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? "Salvataggio..." : selectedCar ? "Salva modifiche" : "Salva auto"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {confirmData.show && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-neutral-800 mb-4">
              Conferma cambio componente
            </h3>
            <p className="text-neutral-700 mb-6 leading-relaxed">
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
                className="btn-secondary"
              >
                Annulla
              </button>
              <button onClick={confirmMountNow} className="btn-primary">
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="fixed top-6 right-6 z-[70] bg-yellow-400 text-black font-semibold px-4 py-3 rounded-xl shadow-lg">
          {toast.message}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueClassName = "text-neutral-900",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-neutral-50 p-4">
      <div className="flex items-center gap-2 text-sm text-neutral-600">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-xl font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function MiniStatCard({
  label,
  value,
  icon,
  valueClassName = "text-neutral-900",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-neutral-50 p-3">
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-lg font-bold ${valueClassName}`}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}
