"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function PrintPage() {
  const { id } = useParams();
  const [car, setCar] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      // Auto + componenti
      const { data: carData, error: carErr } = await supabase
        .from("cars")
        .select("id, name, chassis_number, components(id, type, identifier, expiry_date)")
        .eq("id", id)
        .single();

      if (!carErr) setCar(carData);

      // Documenti
      const { data: docsData, error: docsErr } = await supabase
        .from("documents")
        .select("id, type, file_url, uploaded_at")
        .eq("car_id", id)
        .order("uploaded_at", { ascending: false });

      if (!docsErr) setDocuments(docsData || []);
    };

    fetchData();
  }, [id]);

  const getExpiryColor = (date: string) => {
    const expiry = new Date(date);
    const now = new Date();
    const months =
      (expiry.getFullYear() - now.getFullYear()) * 12 +
      (expiry.getMonth
