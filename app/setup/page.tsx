"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SetupPage() {
  const [setupData, setSetupData] = useState({
    frontWing: "",
    rearWing: "",
    rake: "",
    camber: "",
    toe: "",
    pressures: "",
    springs: "",
    antiroll: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSetupData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 bg-neutral-950 min-h-screen text-yellow-400">
      <h1 className="text-3xl font-bold text-center uppercase tracking-widest">
        Setup Griiip G1
      </h1>

      <Card className="bg-neutral-900 border border-yellow-600 rounded-2xl shadow-xl">
        <CardContent className="p-4 md:p-8 flex flex-col items-center gap-6">
          
          {/* --- Immagini in alto --- */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-5xl">
            <Image
              src="/in-alto-a-sinistra.png"
              alt="in alto sinistra"
              width={200}
              height={100}
              className="mx-auto"
            />
            <Image
              src="/in-alto-al-centro.png"
              alt="in alto centro"
              width={200}
              height={100}
              className="mx-auto"
            />
            <Image
              src="/in-alto-a-destra.png"
              alt="in alto destra"
              width={200}
              height={100}
              className="mx-auto"
            />
          </div>

          {/* --- Macchina centrale --- */}
          <div className="w-full flex justify-center my-4">
            <Image
              src="/macchina-al-centro.png"
              alt="macchina"
              width={600}
              height={800}
              className="max-w-full h-auto"
            />
          </div>

          {/* --- Immagini in basso --- */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-3xl">
            <Image
              src="/in-basso-a-sinistra.png"
              alt="in basso sinistra"
              width={200}
              height={10
