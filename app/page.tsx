"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [cars, setCars] = useState(0);
  const [components, setComponents] = useState(0);
  const [maintenances, setMaintenances] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      const { count: carsCount } = await supabase
        .from("cars")
        .select("*", { count: "exact", head: true });

      const { count: componentsCount } = await supabase
        .from("components")
        .select("*", { count: "exact", head: true });

      const { count: maintenancesCount } = await supabase
        .from("maintenances")
        .select("*", { count: "exact", head: true });

      setCars(carsCount || 0);
      setComponents(componentsCount || 0);
      setMaintenances(maintenancesCount || 0);
    };

    fetchCounts();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">🏎️ Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-lg shadow bg-gray-100 dark:bg-gray-700">
          <h2 className="text-xl font-semibold">🚗 Auto</h2>
          <p className="text-3xl font-bold mt-2">{cars}</p>
        </div>

        <div className="p-6 rounded-lg shadow bg-gray-100 dark:bg-gray-700">
          <h2 className="text-xl font-semibold">⚙️ Componenti</h2>
          <p className="text-3xl font-bold mt-2">{components}</p>
        </div>

        <div className="p-6 rounded-lg shadow bg-gray-100 dark:bg-gray-700">
          <h2 className="text-xl font-semibold">🛠️ Manutenzioni</h2>
          <p className="text-3xl font-bold mt-2">{maintenances}</p>
        </div>
      </div>
    </div>
  );
}
