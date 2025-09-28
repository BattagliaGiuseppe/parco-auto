import Image from "next/image";
import Link from "next/link";
import { Car, Wrench, BarChart3, CalendarDays, Settings } from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-gray-800">
        <Image
          src="https://www.battagliaracingcar.com/wp-content/uploads/2023/12/C1-1536x1078.png"
          alt="Battaglia Racing Car Logo"
          width={48}
          height={48}
          className="object-contain"
        />
        <span className="font-bold text-lg">Parco Auto</span>
      </div>

      {/* Menu */}
      <nav className="flex-1 mt-6 space-y-2 px-4">
        <Link href="/cars" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <Car size={20} />
          <span>Auto</span>
        </Link>

        <Link href="/components" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <Wrench size={20} />
          <span>Componenti</span>
        </Link>

        <Link href="/maintenances" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <BarChart3 size={20} />
          <span>Manutenzioni</span>
        </Link>

        <Link href="/calendar" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <CalendarDays size={20} />
          <span>Calendario</span>
        </Link>

        <Link href="/settings" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <Settings size={20} />
          <span>Impostazioni</span>
        </Link>
      </nav>
    </aside>
  );
}
