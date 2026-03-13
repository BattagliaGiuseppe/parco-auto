"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Save, Loader2, Wrench } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type Car = {
  id: string;
  name: string;
};

export default function EditComponentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cars, setCars] = useState<Car[]>([]);

  const [type, setType] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [carId, setCarId] = useState("");
  const [hours, setHours] = useState("");
  const [lifeHours, setLifeHours] = useState("");
  const [warningHours, setWarningHours] = useState("");
  const [revisionHours, setRevisionHours] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: component } = await supabase
      .from("components")
      .select("*")
      .eq("id", id)
      .single();

    const { data: carsData } = await supabase
      .from("cars")
      .select("id,name")
      .order("name");

    if (component) {
      setType(component.type || "");
      setIdentifier(component.identifier || "");
      setCarId(component.car_id || "");
      setHours(component.hours ?? 0);
      setLifeHours(component.life_hours ?? "");
      setWarningHours(component.warning_threshold_hours ?? "");
      setRevisionHours(component.revision_threshold_hours ?? "");
      setExpiryDate(component.expiry_date ?? "");
    }

    setCars((carsData as Car[]) || []);
    setLoading(false);
  };

  const saveComponent = async () => {
    if (!type || !identifier) {
      alert("Compila tipo e identificativo");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("components")
      .update({
        type,
        identifier,
        car_id: carId || null,
        hours: Number(hours || 0),
        life_hours: lifeHours ? Number(lifeHours) : null,
        warning_threshold_hours: warningHours ? Number(warningHours) : null,
        revision_threshold_hours: revisionHours ? Number(revisionHours) : null,
        expiry_date: expiryDate || null,
      })
      .eq("id", id);

    setSaving(false);

    if (error) {
      alert("Errore salvataggio");
      return;
    }

    router.push(`/components/${id}`);
  };

  if (loading) {
    return (
      <div className="card-base p-10 text-center">
        <Loader2 className="animate-spin inline-block mr-2" />
        Caricamento componente...
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-6 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Modifica componente</h1>
            <p className="text-yellow-200 text-sm">
              Aggiorna le informazioni del componente
            </p>
          </div>

          <Link
            href={`/components/${id}`}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Torna al componente
          </Link>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">

          <Field label="Tipo">
            <input
              className="input-base"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </Field>

          <Field label="Identificativo">
            <input
              className="input-base"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </Field>

          <Field label="Auto assegnata">
            <select
              className="input-base"
              value={carId}
              onChange={(e) => setCarId(e.target.value)}
            >
              <option value="">Non assegnato</option>
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
            />
          </Field>

          <Field label="Soglia attenzione">
            <input
              type="number"
              step="0.01"
              className="input-base"
              value={warningHours}
              onChange={(e) => setWarningHours(e.target.value)}
            />
          </Field>

          <Field label="Soglia revisione">
            <input
              type="number"
              step="0.01"
              className="input-base"
              value={revisionHours}
              onChange={(e) => setRevisionHours(e.target.value)}
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

        </div>

        <div className="p-6 flex gap-3">
          <button
            onClick={saveComponent}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Salvataggio..." : <><Save size={16}/> Salva</>}
          </button>

          <Link href={`/components/${id}`} className="btn-secondary">
            Annulla
          </Link>
        </div>
      </section>
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
      <div className="text-sm font-semibold mb-1">{label}</div>
      {children}
    </div>
  );
}
