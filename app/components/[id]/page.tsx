"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

export default function ComponentDetailPage() {
  const params = useParams();
  const componentId = params?.id as string;

  const [component, setComponent] = useState<any>(null);
  const [maintenances, setMaintenances] = useState<any[]>([]);
  const [car, setCar] = useState<any>(null);

  const fetchDetails = async () => {
    // Dati del componente
    const { data: compData } = await supabase
      .from("components")
      .select("*")
      .eq("id", componentId)
      .single();
    setComponent(compData);

    // Se è installato, recupera su quale auto si trova
    if (compData?.status === "installato") {
      const { data: carData } = await supabase
        .from("car_components")
        .select("cars(name, chassis_number)")
        .eq("component_id", componentId)
        .is("removed_at", null)
        .single();
      setCar(carData?.cars || null);
    }

    // Storico manutenzioni collegate
    const { data: maintData } = await supabase
      .from("maintenances")
      .select("*")
      .eq("component_id", componentId)
      .order("performed_at", { ascending: false });
    setMaintenances(maintData || []);
  };

  useEffect(() => {
    if (componentId) fetchDetails();
  }, [componentId]);

  if (!component) return <p>Caricamento...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">
        ⚙️ {component.type} – {component.identifier}
      </h1>

      {/* Info principali */}
      <p className="mb-2">
        <strong>Omologazione:</strong>{" "}
        {component.homologation || "N/A"}
      </p>
      <p className="mb-2">
        <strong>Scadenza:</strong>{" "}
        {component.expiry_date || "Nessuna"}
      </p>
      <p className="mb-6">
        <strong>Stato:</strong>{" "}
        <span
          className={`font-bold ${
            component.status === "installato"
              ? "text-green-600"
              : "text-gray-500"
          }`}
        >
          {component.status}
        </span>
        {car && ` (installato su ${car.name} – telaio ${car.chassis_number})`}
      </p>

      {/* Storico manutenzioni */}
      <h2 className="text-xl font-semibold mb-2">🛠️ Storico manutenzioni</h2>
      {maintenances.length === 0 ? (
        <p>Nessuna manutenzione registrata</p>
      ) : (
        <ul className="space-y-2">
          {maintenances.map((m) => (
            <li key={m.id} className="p-3 border rounded">
              {m.performed_at?.split("T")[0]} – {m.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
