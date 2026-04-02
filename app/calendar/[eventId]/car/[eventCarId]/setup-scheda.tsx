"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const [data, setData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: row } = await supabase
        .from("event_car_data")
        .select("data")
        .eq("event_car_id", eventCarId)
        .eq("section", "setup")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setData((row as any)?.data || {});
    }
    load();
  }, [eventCarId]);

  async function save() {
    setSaving(true);
    try {
      await supabase.from("event_car_data").insert([{ event_car_id: eventCarId, section: "setup", data }]);
      alert("Setup salvato");
    } catch (err) {
      console.error(err);
      alert("Errore salvataggio setup");
    } finally { setSaving(false); }
  }

  const fields = [
    ["ride_height_front", "Altezza anteriore"],
    ["ride_height_rear", "Altezza posteriore"],
    ["camber_front", "Camber anteriore"],
    ["camber_rear", "Camber posteriore"],
    ["toe_front", "Toe anteriore"],
    ["toe_rear", "Toe posteriore"],
    ["tyre_pressure_front", "Pressione ant."],
    ["tyre_pressure_rear", "Pressione post."],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {fields.map(([key, label]) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">{label}</label>
            <input className="w-full rounded-xl border p-3" value={data[key] || ""} onChange={(e) => setData((prev) => ({ ...prev, [key]: e.target.value }))} />
          </div>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-neutral-700">Note setup</label>
        <textarea className="min-h-[110px] w-full rounded-xl border p-3" value={data.notes || ""} onChange={(e) => setData((prev) => ({ ...prev, notes: e.target.value }))} />
      </div>
      <button onClick={save} disabled={saving} className="rounded-xl bg-yellow-400 px-4 py-2 font-bold text-black hover:bg-yellow-500">{saving ? "Salvataggio..." : "Salva setup"}</button>
    </div>
  );
}
