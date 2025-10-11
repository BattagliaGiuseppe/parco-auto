"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SetupCard({ carName }: { carName: string }) {
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

  const handleSave = () => {
    alert(`Setup salvato per ${carName} (funzione in sviluppo)`);
  };

  const handleExport = () => {
    alert(`Esportazione PDF in sviluppo per ${carName}`);
  };

  return (
    <Card className="bg-neutral-900 border border-yellow-600 rounded-2xl shadow-xl mt-6">
      <CardContent className="p-4 md:p-8 flex flex-col items-center gap-6 text-yellow-400">
        
        <h2 className="text-2xl font-bold uppercase text-center">
          Setup {carName}
        </h2>

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
            height={100}
            className="mx-auto"
          />
          <Image
            src="/in-basso-a-destra.png"
            alt="in basso destra"
            width={200}
            height={100}
            className="mx-auto"
          />
        </div>

        {/* --- Form Setup --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mt-6">
          <div>
            <label className="text-sm">Ala Anteriore</label>
            <Input
              name="frontWing"
              value={setupData.frontWing}
              onChange={handleChange}
              placeholder="Valore ala anteriore"
              className="bg-neutral-800 border-yellow-700 text-yellow-200"
            />
          </div>

          <div>
            <label className="text-sm">Ala Posteriore</label>
            <Input
              name="rearWing"
              value={setupData.rearWing}
              onChange={handleChange}
              placeholder="Valore ala posteriore"
              className="bg-neutral-800 border-yellow-700 text-yellow-200"
            />
          </div>

          <div>
            <label className="text-sm">Rake</label>
            <Input
              name="rake"
              value={setupData.rake}
              onChange={handleChange}
              placeholder="mm o °"
              className="bg-neutral-800 border-yellow-700 text-yellow-200"
            />
          </div>

          <div>
            <label className="text-sm">Camber</label>
            <Input
              name="camber"
              value={setupData.camber}
              onChange={handleChange}
              placeholder="°"
              className="bg-neutral-800 border-yellow-700 text-yellow-200"
            />
          </div>

          <div>
            <label className="text-sm">Toe</label>
            <Input
              name="toe"
              value={setupData.toe}
              onChange={handleChange}
              placeholder="mm o °"
              className="bg-neutral-800 border-yellow-700 text-yellow-200"
            />
          </div>

          <div>
            <label className="text-sm">Pressioni</label>
            <Input
              name="pressures"
              value={setupData.pressures}
              onChange={handleChange}
              placeholder="es. 1.60 / 1.55"
              className="bg-neutral-800 border-yellow-700 text-yellow-200"
            />
          </div>

          <div>
            <label className="text-sm">Molle</label>
            <Input
              name="springs"
              value={setupData.springs}
              onChange={handleChange}
              placeholder="es. 80N/mm"
              className="bg-neutral-800 border-yellow-700 text-yellow-200"
            />
          </div>

          <div>
            <label className="text-sm">Barre Antirollio</label>
            <Input
              name="antiroll"
              value={setupData.antiroll}
              onChange={handleChange}
              placeholder="soft / medium / hard"
              className="bg-neutral-800 border-yellow-700 text-yellow-200"
            />
          </div>
        </div>

        {/* --- Pulsanti --- */}
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <Button
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-6 py-3 rounded-xl shadow-md"
            onClick={handleSave}
          >
            💾 Salva Setup
          </Button>

          <Button
            className="bg-neutral-800 border border-yellow-600 hover:bg-neutral-700 text-yellow-400 font-bold px-6 py-3 rounded-xl shadow-md"
            onClick={handleExport}
          >
            📤 Esporta PDF
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
