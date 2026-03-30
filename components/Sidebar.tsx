"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CarFront,
  Wrench,
  CalendarDays,
  Boxes,
  Users,
  Package,
  Activity,
  Settings,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const mainItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={18} />,
  },
  {
    href: "/calendar",
    label: "Eventi",
    icon: <CalendarDays size={18} />,
  },
  {
    href: "/cars",
    label: "Auto",
    icon: <CarFront size={18} />,
  },
  {
    href: "/components",
    label: "Componenti",
    icon: <Boxes size={18} />,
  },
  {
    href: "/maintenances",
    label: "Manutenzioni",
    icon: <Wrench size={18} />,
  },
  {
    href: "/drivers",
    label: "Piloti",
    icon: <Users size={18} />,
  },
];

const advancedItems: NavItem[] = [
  {
    href: "/inventory",
    label: "Magazzino",
    icon: <Package size={18} />,
  },
  {
    href: "/telemetry",
    label: "Telemetria",
    icon: <Activity size={18} />,
  },
  {
    href: "/settings",
    label: "Impostazioni",
    icon: <Settings size={18} />,
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const active = isActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        active
          ? "bg-yellow-400 text-black shadow-sm"
          : "text-neutral-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className={active ? "text-black" : "text-neutral-400 group-hover:text-white"}>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen overflow-y-auto border-r border-neutral-800 bg-neutral-950 lg:block">
      <div className="flex h-full flex-col px-4 py-5">
        <div className="mb-6 px-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-400/80">
              Battaglia Racing Car
            </div>
            <div className="mt-2 text-xl font-bold text-white">Parco Auto</div>
            <div className="mt-1 text-sm text-neutral-400">
              Gestionale tecnico motorsport
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6">
          <div>
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Core
            </div>
            <nav className="space-y-1">
              {mainItems.map((item) => (
                <SidebarLink key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
          </div>

          <div>
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Avanzato
            </div>
            <nav className="space-y-1">
              {advancedItems.map((item) => (
                <SidebarLink key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="text-sm font-semibold text-white">Struttura PRO</div>
          <div className="mt-1 text-xs leading-5 text-neutral-400">
            Operativo, analitico e archivi separati per una gestione più chiara e vendibile.
          </div>
        </div>
      </div>
    </aside>
  );
}