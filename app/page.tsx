import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";

export default function Home() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 bg-gray-100 min-h-screen p-6">
        <Dashboard />
      </main>
    </div>
  );
}
