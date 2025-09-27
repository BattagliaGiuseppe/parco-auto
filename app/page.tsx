"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function Dashboard() {
  const [stats, setStats] = useState({
    cars: 0,
    components: 0,
    maintenances: 0,
  });
  const [expiring, setExpiring] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    // Auto
    const { count: carsCount } = await supabase
      .from("cars")
      .select("*", { count: "exact", head: true });

    // Componenti
    const { count: compsCount } = await supabase
      .from("components")
      .select("*", { count: "exact", head: true });

    // Manutenzioni
    const { count: maintCount } = await supabase
      .from("maintenances")
      .select("*", { count: "exact", head: true });

    // Componenti in scadenza entro 30 giorni
    const today = new Date();
    const limit = new Date();
    limit.setDate(today.getDate() + 30);

    const { data: expiringData } = await supabase
      .from("components")
      .select("*")
      .lte("expiry_date", limit.toISOString().split("T")[0])
      .gte("expiry_date", today.toISOString().split("T")[0]);

    setStats({
      cars: carsCount || 0,
      components: compsCount || 0,
      maintenances: maintCount || 0,
    });
    setExpiring(expiringData || []);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">📊 Dashboard Parco Auto</h1>

      {/* Cards statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <Link
          href="/cars"
          className="p-6 bg-blue-600 text-white rounded-xl shadow hover:opacity-90 transition"
        >
          <h2 className="text-xl font-semibold">🚗 Auto</h2>
          <p className="text-3xl">{stats.cars}</p>
        </Link>

        <Link
          href="/components"
          className="p-6 bg-green-600 text-white rounded-xl shadow hover:opacity-90 transition"
        >
          <h2 className="text-xl font-semibold">⚙️ Componenti</h2>
          <p className="text-3xl">{stats.components}</p>
        </Link>

        <Link
          href="/maintenances"
          className="p-6 bg-yellow-600 text-white rounded-xl shadow hover:opacity-90 transition"
        >
          <h2 className="text-xl font-semibold">🛠️ Manutenzioni</h2>
          <p className="text-3xl">{stats.maintenances}</p>
        </Link>
      </div>

      {/* Componenti in scadenza */}
      <h2 className="text-2xl font-semibold mb-4">⏰ Scadenze entro 30 giorni</h2>
      {expiring.length === 0 ? (
        <p>Nessun componente in scadenza a breve.</p>
      ) : (
        <ul className="space-y-2">
          {expiring.map((c) => (
            <li key={c.id} className="p-3 border rounded bg-red-50">
              {c.type} – {c.identifier} (Scadenza: {c.expiry_date})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
