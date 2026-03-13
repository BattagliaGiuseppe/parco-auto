"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { ArrowLeft, PlusCircle, Save, Wrench } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type CarOption = {
  id: string;
  name: string;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewComponentPage() {
  const router = useRouter();

  const [cars, setCars] = useState<CarOption[]>([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [carId, setCarId] = useState("");
  const [hours, setHours] = useState("0");
  const [lifeHours, setLifeHours] = useState("");
  const [warningThresholdHours, setWarningThresholdHours] = useState("");
  const [revisionThresholdHours, setRevisionThresholdHours] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [lastMaintenanceDate, setLastMaintenanceDate] = useState(todayIso());

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  useEffect(() => {
    const loadCars = async () => {
      setLoadingCars(true);

      try {
        const ctx = await getCurrentTeamContext();

        const { data, error } = await supabase
          .from("cars")
          .select("id, name")
          .eq("team_id", ctx.teamId)
          .order("name", { ascending: true });

        if (error) throw error;

        setCars((data as CarOption[]) || []);
      } catch (error) {
        console.error("Errore caricamento auto:", error);
        showToast("Errore caricamento auto", "error");
      } finally {
        setLoadingCars(false);
      }
    };

    loadCars();
  }, []);

  const saveComponent = async () => {
    if (!type.trim() || !identifier.trim()) {
      showToast("Compila almeno tipo e identificativo", "error");
      return;
    }

    setSaving(true);

    try {
      const ctx = await getCurrentTeamContext();

      const payload = {
        team_id: ctx.teamId,
        type: type.trim(),
        identifier: identifier.trim(),
        car_id: carId || null,
        hours: Number(hours || 0),
        life_hours: lifeHours ? Number(lifeHours) : null,
        warning_threshold_hours: warningThresholdHours
          ? Number(warningThresholdHours)
          : null,
        revision_threshold_hours: revisionThresholdHours
          ? Number(revisionThresholdHours)
          : null,
        expiry_date: expiryDate || null,
        last_maintenance_date: lastMaintenanceDate || null,
      };

      const { data, error } = await supabase
        .from("components")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;

      showToast("Componente creato correttamente");
      router.push(`/components/${data.id}`);
    } catch (error) {
      console.error("Errore creazione componente:", error);
      showToast("Errore durante la creazione del componente", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <Wrench size={14} />
                Creazione componente
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Nuovo componente
              </h1>

              <p className="text-yellow-100/75 text-sm mt-2">
                Inserisci il nuovo componente con soglie, scadenza e auto associata.
              </p>
            </div>

            <Link
              href="/components"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-yellow-400 font-semibold"
            >
              <ArrowLeft size={16} /> Torna ai componenti
            </Link>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tipo componente *">
              <input
                className="input-base"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="Es. Cambio, Mozzo, Serbatoio..."
              />
            </Field>

            <Field label="Identificativo *">
              <input
                className="input-base"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Es. G1-004"
              />
            </Field>

            <Field label="Auto associata">
              <select
                className="input-base"
                value={carId}
                onChange={(e) => setCarId(e.target.value)}
                disabled={loadingCars}
              >
                <option value="">-- Nessuna auto assegnata --</option>
                {cars.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ore attuali">
              <input
                type="number"
                step="0.01"
                className="input-base"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </Field>

            <Field label="Ore vita totale">
              <input
                type="number"
                step="0.01"
                className="input-base"
                value={lifeHours}
                onChange={(e) => setLifeHours(e.target.value)}
                placeholder="Es. 40"
              />
            </Field>

            <Field label="Soglia attenzione (ore)">
              <input
                type="number"
                step="0.01"
                className="input-base"
                value={warningThresholdHours}
                onChange={(e) => setWarningThresholdHours(e.target.value)}
                placeholder="Es. 30"
              />
            </Field>

            <Field label="Soglia revisione (ore)">
              <input
                type="number"
                step="0.01"
                className="input-base"
                value={revisionThresholdHours}
                onChange={(e) => setRevisionThresholdHours(e.target.value)}
                placeholder="Es. 40"
              />
            </Field>

            <Field label="Scadenza">
              <input
                type="date"
                className="input-base"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </Field>

            <Field label="Ultima manutenzione">
              <input
                type="date"
                className="input-base"
                value={lastMaintenanceDate}
                onChange={(e) => setLastMaintenanceDate(e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button onClick={saveComponent} disabled={saving} className="btn-primary">
              {saving ? <Save size={18} /> : <PlusCircle size={18} />}
              {saving ? "Salvataggio..." : "Crea componente"}
            </button>

            <Link href="/components" className="btn-secondary">
              Annulla
            </Link>
          </div>
        </div>
      </section>

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-lg font-semibold ${
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}