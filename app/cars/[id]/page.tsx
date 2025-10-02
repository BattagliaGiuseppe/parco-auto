"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function CarDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [car, setCar] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("cars")
        .select("id, name, chassis_number, components(id, type, identifier, expiry_date, is_active)")
        .eq("id", id)
        .single();
      setCar(data);
    };
    load();
  }, [id]);

  if (!car) return <div className="p-6">Caricamento…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{car.name}</h1>
      <p className="text-gray-600">{car.chassis_number}</p>

      <div className="space-y-2">
        {(car.components || []).map((c: any) => (
          <div key={c.id} className="p-3 rounded border bg-white">
            {c.type} — {c.identifier} {c.expiry_date ? `(${new Date(c.expiry_date).toLocaleDateString("it-IT")})` : ""}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Link href={`/cars/${id}/documents`} className="px-3 py-2 rounded bg-gray-900 text-yellow-500">
          Documenti
        </Link>
        <Link href={`/cars/${id}/print`} className="px-3 py-2 rounded bg-gray-100 text-gray-800">
          Stampa
        </Link>
      </div>
    </div>
  );
}
