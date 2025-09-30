"use client";

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Settings size={24} /> ⚙️ Impostazioni
      </h1>

      <p className="text-gray-600">
        Qui potrai gestire le impostazioni del sistema. (Tema, utenti, notifiche, ecc.)
      </p>
    </div>
  );
}
