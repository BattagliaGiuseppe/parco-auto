"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";

export default function CarDetailPage() {
  const params = useParams();
  const carId = params?.id as string;

  const [car, setCar] = useState<any>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [maintenances, setMaintenances] = useState<any[]>([]);

  const fetchCarDetails = async () => {
    // Dati auto
    const { data: carData } = await supabase.from("cars").select("*").eq("id", carId).single();
    setCar(carData);

    // Componenti installati
    const { data: compData } = await supabase
      .from("car_components")
      .select("*, components(id, type, identifier, homologation, expiry_date)")
      .eq("car_id", carId)
      .is("removed_at", null);

    setComponents(compData || []);

    // Storico manutenzioni dei componenti dell'auto
    const { data: maintData } = await supabase
      .from("maintenances")
      .select("*, components(type, identifier)")
      .in("component_id", compData?.map((c: any) => c.component_id) || []);

    setMaintenances(maintData || []);
  };

  useEffect(() => {
    if (carId) fetchCarDetails();
  }, [carId]);

  if (!car) return <p>Caricamento...</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">🚗 {car.name}</h1>
      <p className="mb-6 text-gray-600 dark:text-gray-300">Telaio: {car.chassis_number}</p>

      {/* Componenti installati */}
      <h2 className="text-xl font-semibold mb-2">⚙️ Componenti attualmente installati</h2>
      {components.length === 0 ? (
        <p className="mb-6">Nessun componente installato</p>
      ) : (
        <ul className="space-y-2 mb-6">
          {components.map((c) => (
            <li key={c.component_id} className="p-3 border rounded">
              {c.components?.type} – {c.components?.identifier}
              {c.components?.expiry_date ? ` (Scadenza: ${c.components?.expiry_date})` : ""}
            </li>
          ))}
        </ul>
      )}

      {/* Storico manutenzioni */}
      <h2 className="text-xl font-semibold mb-2">🛠️ Storico manutenzioni</h2>
      {maintenances.length === 0 ? (
        <p>Nessuna manutenzione registrata</p>
      ) : (
        <ul className="space-y-2">
          {maintenances.map((m) => (
            <li key={m.id} className="p-3 border rounded">
              {m.performed_at?.split("T")[0]} – {m.description} ({m.components?.type} {m.components?.identifier})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
