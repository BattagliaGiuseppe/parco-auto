"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Edit, PlusCircle, Search } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function ComponentsPage() {
  const [components, setComponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [filterCar, setFilterCar] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Stato modale componente
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // Stato popup conferma cambio auto
  const [confirmPopup, setConfirmPopup] = useState<{
    show: boolean;
    oldCar: string | null;
    newCar: string | null;
  }>({ show: false, oldCar: null, newCar: null });

  const fetchComponents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("components")
      .select(
        "id, type, identifier, expiry_date, is_active, last_maintenance_date, car_id (name)"
      )
      .order("id", { ascending: true });

    if (!error) setComponents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchComponents();
  }, []);

  const getExpiryColor = (date: string) => {
    const expiry = new Date(date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth() - now.getMonth());

    if (months > 12) return "text-green-600 font-semibold";
    if (months > 6) return "text-orange-500 font-semibold";
    if (expiry < now) return "text-red-600 font-bold";
    return "text-yellow-500";
  };

  // filtro in base a stato + auto + tipo + ricerca
  const filteredComponents = components.filter((c) => {
    if (filterCar && c.car_id?.name !== filterCar) return false;
    if (filterType && c.type !== filterType) return false;

    const matchSearch =
      c.type.toLowerCase().includes(search.toLowerCase()) ||
      c.identifier.toLowerCase().includes(search.toLowerCase()) ||
      (c.car_id?.name || "").toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    if (!c.expiry_date) return true;
    const expiry = new Date(c.expiry_date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth() - now.getMonth());

    if (filter === "all") return true;
    if (filter === "expiring") return months <= 6 && months >= 0;
    if (filter === "expired") return expiry < now;
    return true;
  });

  // gestione apertura modale
  const openAddModal = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEditModal = (comp: any) => {
    setEditing(comp);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalOpen(false);
    // TODO: integrazione con Supabase (insert/update)
    if (editing) {
      console.log("Aggiorna componente:", editing.id);
    } else {
      console.log("Aggiungi nuovo componente");
    }
    await fetchComponents();
  };

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800">🔧 Componenti</h1>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Barra ricerca */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per tipo, identificativo o auto..."
              className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm pl-9 focus:ring-2 focus:ring-yellow-400"
            />
            <Search
              size={16}
