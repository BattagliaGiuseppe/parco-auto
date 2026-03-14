"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import {
  Wrench,
  Link2,
  Unlink,
  CheckCircle,
  XCircle,
  History,
} from "lucide-react";

type CarItem = {
  id: string;
  name: string;
};

type ComponentItem = {
  id: string;
  type: string;
  identifier: string;
  car_id: string | null;
};

type MountRow = {
  id: string;
  car_id: string | null;
  component_id: string;
  status: string | null;
  mounted_at: string | null;
  removed_at: string | null;
  hours_used: number | null;
};

type MountRowView = MountRow & {
  carName: string;
  componentLabel: string;
};

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

function formatHours(value: number | null | undefined) {
  return Number(value ?? 0).toFixed(2);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("it-IT");
}

export default function MountsPage() {
  const [mounts, setMounts] = useState<MountRow[]>([]);
  const [cars, setCars] = useState<CarItem[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [selectedCar, setSelectedCar] = useState("");
  const [selectedComponent, setSelectedComponent] = useState("");
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const ctx = await getCurrentTeamContext();

      const [
        { data: carsData, error: carsError },
        { data: componentsData, error: componentsError },
        { data: mountsData, error: mountsError },
      ] = await Promise.all([
        supabase
          .from("cars")
          .select("id, name")
          .eq("team_id", ctx.teamId)
          .order("name", { ascending: true }),
        supabase
          .from("components")
          .select("id, type, identifier, car_id")
          .eq("team_id", ctx.teamId)
          .order("identifier", { ascending: true }),
        supabase
          .from("car_components")
          .select("id, car_id, component_id, status, mounted_at, removed_at, hours_used")
          .eq("team_id", ctx.teamId)
          .order("mounted_at", { ascending: false }),
      ]);

      if (carsError) throw carsError;
      if (componentsError) throw componentsError;
      if (mountsError) throw mountsError;

      setCars((carsData || []) as CarItem[]);
      setComponents((componentsData || []) as ComponentItem[]);
      setMounts((mountsData || []) as MountRow[]);
    } catch (error: any) {
      showToast(`Errore caricamento montaggi: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const availableComponents = useMemo(() => {
    return components.filter((component) => !component.car_id);
  }, [components]);

  const mountRowsView = useMemo<MountRowView[]>(() => {
    return mounts.map((row) => {
      const car = cars.find((item) => item.id === row.car_id);
      const component = components.find((item) => item.id === row.component_id);

      return {
        ...row,
        carName: car?.name || "—",
        componentLabel: component
          ? `${component.type} – ${component.identifier}`
          : row.component_id,
      };
    });
  }, [mounts, cars, components]);

  const activeMounts = useMemo(
    () => mountRowsView.filter((row) => !row.removed_at),
    [mountRowsView]
  );

  const historyMounts = useMemo(
    () => mountRowsView.filter((row) => row.removed_at),
    [mountRowsView]
  );

  const addMount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCar || !selectedComponent) {
      showToast("Seleziona auto e componente", "error");
      return;
    }

    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase.rpc("mount_component", {
        p_team_id: ctx.teamId,
        p_car_id: selectedCar,
        p_component_id: selectedComponent,
      });

      if (error) {
        showToast(`Errore montaggio: ${error.message}`, "error");
        return;
      }

      setSelectedCar("");
      setSelectedComponent("");
      showToast("Componente montato correttamente", "success");
      await fetchData();
    } catch (error: any) {
      showToast(`Errore montaggio: ${error.message}`, "error");
    }
  };

  const unmount = async (mountRow: MountRowView) => {
    const confirmed = confirm(
      `Vuoi smontare ${mountRow.componentLabel} da ${mountRow.carName}?`
    );
    if (!confirmed) return;

    try {
      const ctx = await getCurrentTeamContext();

      const { error } = await supabase.rpc("unmount_component", {
        p_team_id: ctx.teamId,
        p_car_component_id: mountRow.id,
      });

      if (error) {
        showToast(`Errore smontaggio: ${error.message}`, "error");
        return;
      }

      showToast("Componente smontato", "success");
      await fetchData();
    } catch (error: any) {
      showToast(`Errore smontaggio: ${error.message}`, "error");
    }
  };

  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Wrench className="text-yellow-500" size={28} />
        <h1 className="text-3xl font-bold text-gray-800">Montaggi Componenti</h1>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Link2 size={18} className="text-yellow-600" /> Nuovo montaggio
        </h2>

        <form onSubmit={addMount} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={selectedCar}
            onChange={(e) => setSelectedCar(e.target.value)}
            className="border p-2 rounded-lg"
            required
          >
            <option value="">Seleziona auto</option>
            {cars.map((car) => (
              <option key={car.id} value={car.id}>
                {car.name}
              </option>
            ))}
          </select>

          <select
            value={selectedComponent}
            onChange={(e) => setSelectedComponent(e.target.value)}
            className="border p-2 rounded-lg"
            required
          >
            <option value="">Seleziona componente smontato</option>
            {availableComponents.map((component) => (
              <option key={component.id} value={component.id}>
                {component.type} – {component.identifier}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 rounded-lg"
          >
            Monta
          </button>
        </form>

        {availableComponents.length === 0 && (
          <p className="text-sm text-gray-500 mt-3">
            Non ci sono componenti smontati disponibili.
          </p>
        )}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <CheckCircle size={18} className="text-green-600" /> Montaggi attivi
        </h2>

        {loading ? (
          <p>Caricamento...</p>
        ) : activeMounts.length === 0 ? (
          <p className="text-gray-500">Nessun montaggio attivo.</p>
        ) : (
          <ul className="space-y-3">
            {activeMounts.map((mount) => (
              <li
                key={mount.id}
                className="p-4 border rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-gray-800">{mount.componentLabel}</div>
                  <div className="text-sm text-gray-600">
                    Su <span className="font-semibold">{mount.carName}</span> dal{" "}
                    {formatDate(mount.mounted_at)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Ore utilizzo registrate: {formatHours(mount.hours_used)}
                  </div>
                </div>

                <button
                  onClick={() => unmount(mount)}
                  className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold"
                >
                  <Unlink size={16} /> Smonta
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white border rounded-2xl shadow-sm p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <History size={18} className="text-yellow-600" /> Storico montaggi
        </h2>

        {loading ? (
          <p>Caricamento...</p>
        ) : historyMounts.length === 0 ? (
          <p className="text-gray-500">Nessuno storico disponibile.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-2 text-left">Componente</th>
                  <th className="p-2 text-left">Auto</th>
                  <th className="p-2 text-left">Da</th>
                  <th className="p-2 text-left">A</th>
                  <th className="p-2 text-left">Ore</th>
                  <th className="p-2 text-left">Stato</th>
                </tr>
              </thead>
              <tbody>
                {historyMounts.map((mount) => (
                  <tr key={mount.id} className="border-t">
                    <td className="p-2">{mount.componentLabel}</td>
                    <td className="p-2">{mount.carName}</td>
                    <td className="p-2">{formatDate(mount.mounted_at)}</td>
                    <td className="p-2">{formatDate(mount.removed_at)}</td>
                    <td className="p-2">{formatHours(mount.hours_used)}</td>
                    <td className="p-2">
                      {mount.status === "mounted" ? "Montato" : "Smontato"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 z-[999] ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}