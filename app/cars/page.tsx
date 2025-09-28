"use client";

import { useEffect, useState } from "react";
import { useSession, useSupabaseClient } from "@supabase/auth-helpers-react";
import Link from "next/link";

export default function CarsPage() {
  const session = useSession();
  const supabase = useSupabaseClient();

  const [cars, setCars] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [chassis, setChassis] = useState("");

  const fetchCars = async () => {
    if (!session) return; // ✅ non loggare se non c’è sessione
    const { data, error } = await supabase.from("cars").select("*");
    if (!error) setCars(data || []);
  };

  const addCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!name || !chassis) return;
    await supabase.from("cars").insert([{ name, chassis_number: chassis }]);
    setName("");
    setChassis("");
    fetchCars();
  };

  const deleteCar = async (id: string) => {
    if (!session) return;
    await supabase.from("cars").delete().eq("id", id);
    fetchCars();
  };

  useEffect(() => {
    fetchCars();
  }, [session]);

  if (!session) {
    return <p className="p-6">Devi fare login per vedere questa pagina.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">🚗 Gestione Auto</h1>
      {/* Form e lista come prima */}
    </div>
  );
}
