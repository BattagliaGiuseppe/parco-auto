import { Car, Wrench, BarChart3, CalendarDays, Settings } from "lucide-react";

export default function Sidebar() {
  return (
    <div className="h-screen w-64 bg-gray-900 text-white flex flex-col shadow-xl">
      {/* Logo */}
      <div className="flex items-center justify-center p-6 border-b border-gray-800">
        <img
          src="https://www.battagliaracingcar.com/wp-content/uploads/2023/12/C1-1536x1078.png"
          alt="Battaglia Racing Car Logo"
          className="h-16 object-contain"
        />
      </div>

      {/* Menu */}
      <nav className="flex-1 mt-6 space-y-2 px-4">
        <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <Car size={20} />
          <span>Parco Auto</span>
        </a>
        <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <Wrench size={20} />
          <span>Manutenzioni</span>
        </a>
        <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <BarChart3 size={20} />
          <span>Report</span>
        </a>
        <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <CalendarDays size={20} />
          <span>Calendario</span>
        </a>
        <a href="#" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800 transition">
          <Settings size={20} />
          <span>Impostazioni</span>
        </a>
      </nav>
    </div>
  );
}
