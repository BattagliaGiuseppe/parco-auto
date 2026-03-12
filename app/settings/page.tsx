"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Settings, Save, Calendar, Bell } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type SettingsRow = {
  id: string;
  team_name: string;
  primary_color: string;
  language: string;
  theme_mode: string;
  email_notifications: boolean;
  calendar_sync: boolean;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [missingSettings, setMissingSettings] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#FFD700");
  const [language, setLanguage] = useState("it");
  const [themeMode, setThemeMode] = useState("auto");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [calendarSync, setCalendarSync] = useState(false);

  const [toast, setToast] = useState("");

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  }

  function applySettings(data: SettingsRow) {
    setSettings(data);

    setTeamName(data.team_name);
    setPrimaryColor(data.primary_color);
    setLanguage(data.language);
    setThemeMode(data.theme_mode);
    setEmailNotifications(data.email_notifications);
    setCalendarSync(data.calendar_sync);
  }

  async function loadSettings() {
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!data) {
      setMissingSettings(true);
    } else {
      applySettings(data);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSave() {
    if (!settings) return;

    try {
      const payload = {
        team_name: teamName,
        primary_color: primaryColor,
        language: language,
        theme_mode: themeMode,
        email_notifications: emailNotifications,
        calendar_sync: calendarSync,
      };

      const { data, error } = await supabase
        .from("app_settings")
        .update(payload)
        .eq("id", settings.id)
        .select("*")
        .single();

      if (error) throw error;

      applySettings(data);
      showToast("Impostazioni salvate");
    } catch (err: any) {
      showToast(err.message);
    }
  }

  async function handleCreateInitialSettings() {
    try {
      const payload = {
        team_name: teamName,
        primary_color: primaryColor,
        language: language,
        theme_mode: themeMode,
        email_notifications: emailNotifications,
        calendar_sync: calendarSync,
      };

      const { data, error } = await supabase
        .from("app_settings")
        .insert([payload])
        .select("*")
        .single();

      if (error) throw error;

      applySettings(data);
      setMissingSettings(false);

      showToast("Configurazione creata");
    } catch (err: any) {
      showToast(err.message);
    }
  }

  if (loading) {
    return (
      <div className={`p-6 ${audiowide.className}`}>
        Caricamento impostazioni...
      </div>
    );
  }

  /*
  =========================
  CONFIGURAZIONE INIZIALE
  =========================
  */

  if (missingSettings) {
    return (
      <div className={`p-6 flex flex-col gap-6 ${audiowide.className}`}>
        <div className="bg-white border rounded-2xl shadow-sm p-8 max-w-xl mx-auto text-center">

          <h1 className="text-2xl font-bold mb-2">
            🏁 Benvenuto
          </h1>

          <p className="text-gray-600 mb-6">
            Configuriamo la webapp per la tua scuderia
          </p>

          <div className="flex flex-col gap-4 text-left">

            <div>
              <label className="text-sm text-gray-600">
                Nome Team
              </label>
              <input
                className="border rounded-lg p-2 w-full"
                value={teamName}
                onChange={(e)=>setTeamName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">
                Lingua
              </label>
              <select
                className="border rounded-lg p-2 w-full"
                value={language}
                onChange={(e)=>setLanguage(e.target.value)}
              >
                <option value="it">Italiano</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-600">
                Colore principale
              </label>
              <input
                type="color"
                value={primaryColor}
                onChange={(e)=>setPrimaryColor(e.target.value)}
                className="w-20 h-10"
              />
            </div>

          </div>

          <button
            onClick={handleCreateInitialSettings}
            className="mt-6 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            CREA CONFIGURAZIONE
          </button>

        </div>

        {toast && (
          <div className="fixed top-6 right-6 bg-yellow-400 text-black px-4 py-2 rounded-lg font-semibold">
            {toast}
          </div>
        )}
      </div>
    );
  }

  /*
  =========================
  PAGINA SETTINGS NORMALE
  =========================
  */

  return (
    <div className={`p-6 flex flex-col gap-8 ${audiowide.className}`}>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings /> Impostazioni
        </h1>

        <button
          onClick={handleSave}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Save size={18}/> Salva
        </button>
      </div>

      {/* GENERALI */}

      <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200 space-y-4">
        <h2 className="text-xl font-bold">Generali</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          <div>
            <label className="text-sm text-gray-600">
              Nome Team
            </label>
            <input
              type="text"
              className="border rounded-lg p-2 w-full"
              value={teamName}
              onChange={(e)=>setTeamName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Colore primario
            </label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e)=>setPrimaryColor(e.target.value)}
              className="w-16 h-10 border rounded-lg"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Lingua
            </label>
            <select
              className="border rounded-lg p-2 w-full"
              value={language}
              onChange={(e)=>setLanguage(e.target.value)}
            >
              <option value="it">Italiano</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600">
              Tema
            </label>
            <select
              className="border rounded-lg p-2 w-full"
              value={themeMode}
              onChange={(e)=>setThemeMode(e.target.value)}
            >
              <option value="auto">Automatico</option>
              <option value="light">Chiaro</option>
              <option value="dark">Scuro</option>
            </select>
          </div>

        </div>
      </div>

      {/* NOTIFICHE */}

      <div className="bg-white shadow-lg rounded-2xl p-6 border border-gray-200 space-y-4">

        <h2 className="text-xl font-bold">Notifiche</h2>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e)=>setEmailNotifications(e.target.checked)}
          />
          <Bell size={16}/>
          <span>Notifiche email</span>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={calendarSync}
            onChange={(e)=>setCalendarSync(e.target.checked)}
          />
          <Calendar size={16}/>
          <span>Sincronizzazione calendario</span>
        </div>

      </div>

      {toast && (
        <div className="fixed top-6 right-6 bg-yellow-400 text-black px-4 py-2 rounded-lg font-semibold">
          {toast}
        </div>
      )}

    </div>
  );
}