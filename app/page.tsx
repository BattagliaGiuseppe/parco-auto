"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getTeamSettings, type TeamSettings } from "@/lib/teamSettings";
import { Audiowide } from "next/font/google";
import {
  CarFront,
  Wrench,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function DashboardPage() {
  const [settings, setSettings] = useState<TeamSettings | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const data = await getTeamSettings();
      setSettings(data);
    };

    loadSettings();
  }, []);

  const teamName = settings?.team_name || "Battaglia Racing";
  const cover = settings?.dashboard_cover_url || null;
  const logo = settings?.team_logo_url || null;

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      {/* Cover dashboard */}
      <section className="relative w-full h-56 rounded-2xl overflow-hidden border border-neutral-200">
        {cover ? (
          <Image
            src={cover}
            alt="Dashboard cover"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-black to-neutral-800" />
        )}

        <div className="absolute inset-0 bg-black/40 flex items-center gap-6 px-8">
          {logo && (
            <div className="relative h-16 w-16 bg-white rounded-xl p-2">
              <Image
                src={logo}
                alt={teamName}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          )}

          <div>
            <h1 className="text-3xl font-bold text-yellow-400">
              {teamName}
            </h1>

            <p className="text-sm text-yellow-100/80">
              Racing Operations Dashboard
            </p>
          </div>
        </div>
      </section>

      {/* Cards principali */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DashboardCard
          icon={<CarFront size={20} />}
          title="Auto"
          value="—"
        />

        <DashboardCard
          icon={<Wrench size={20} />}
          title="Componenti"
          value="—"
        />

        <DashboardCard
          icon={<CalendarDays size={20} />}
          title="Eventi"
          value="—"
        />

        <DashboardCard
          icon={<AlertTriangle size={20} />}
          title="Alert"
          value="—"
        />
      </section>
    </div>
  );
}

function DashboardCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="bg-white border rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2 text-neutral-600">
        {icon}
        <span className="text-sm font-semibold">{title}</span>
      </div>

      <div className="text-2xl font-bold text-neutral-900">{value}</div>
    </div>
  );
}