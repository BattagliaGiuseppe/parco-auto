"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar as CalendarIcon,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { it } from "date-fns/locale";

// Localizzazione calendario
const locales = {
  it: it,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

export default function Dashboard() {
  const [stats, setStats] = useState({
    cars: 0,
    components: 0,
    maintenances: 0,
  });
  const [expiring, setExpiring] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

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

    // Eventi (se hai tabella "events")
    const { data: eventsData } = await supabase.from("events").select("*");

    setStats({
      cars: carsCount || 0,
      components: compsCount || 0,
      maintenances: maintCount || 0,
    });
    setExpiring(expiringData || []);
    setEvents(
      eventsData
        ? eventsData.map((e) => ({
            id: e.id,
            title: e.title,
            start: new Date(e.start_date),
            end: new Date(e.end_date),
          }))
        : []
    );
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Dati demo per grafico (da collegare ai tuoi dati reali se vuoi)
  const sampleData = [
    { name: "Auto #12", motore: 80 },
    { name: "Auto #8", motore: 55 },
    { name: "Auto #5", motore: 30 },
  ];

  return (
    <div className="p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-800">📊 Dashboard Parco Auto</h1>

      {/* Card statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/cars"
          className="bg-white shadow-lg rounded-2xl p-6 flex items-center gap-4 border-l-4
