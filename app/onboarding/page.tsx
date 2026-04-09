"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Building2, Rocket, ShieldCheck } from "lucide-react";
import { Audiowide } from "next/font/google";
import { brandConfig } from "@/lib/brand";
import { listMyPendingTeamInvites, setPendingInviteToken } from "@/lib/teamContext";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function OnboardingPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [vehicleType, setVehicleType] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [checkingInvites, setCheckingInvites] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkInvites() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active || !session) {
          setCheckingInvites(false);
          return;
        }

        const invites = await listMyPendingTeamInvites();
        const firstInvite = invites[0];

        if (!active) return;

        if (firstInvite?.token) {
          setPendingInviteToken(firstInvite.token);
          router.replace(`/accept-invite?token=${encodeURIComponent(firstInvite.token)}`);
          return;
        }
      } catch (error) {
        console.warn("Nessun invito pendente da gestire in onboarding:", error);
      } finally {
        if (active) {
          setCheckingInvites(false);
        }
      }
    }

    void checkInvites();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.rpc("create_team_for_current_user", {
        p_team_name: teamName.trim(),
        p_vehicle_type: vehicleType,
      });
      if (error) throw error;
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message || "Errore creazione workspace");
    } finally {
      setLoading(false);
    }
  }

  if (checkingInvites) {
    return (
      <div className={`flex min-h-screen items-center justify-center bg-neutral-100 p-6 ${audiowide.className}`}>
        <div className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl text-center text-neutral-500">
          Verifica inviti e configurazione account...
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen items-center justify-center bg-neutral-100 p-6 ${audiowide.className}`}>
      <div className="w-full max-w-xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-yellow-400 p-2 text-black"><Rocket size={20} /></div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Configura il primo workspace</h1>
            <p className="mt-1 text-sm text-neutral-500">Questo flusso è pensato per l&apos;owner iniziale del team. I collaboratori entrano invece tramite invito.</p>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm leading-6 text-yellow-900">
          <div className="inline-flex items-center gap-2 font-semibold">
            <ShieldCheck size={16} /> Procedura corretta per il multi-team
          </div>
          <div className="mt-2">
            Crea qui il workspace solo se stai attivando il team principale. Per meccanici, ingegneri, piloti o collaboratori usa invece il modulo <strong>Team &amp; Accessi</strong> e invia un invito dedicato.
          </div>
        </div>

        <form onSubmit={handleCreateWorkspace} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Nome team</label>
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
              <Building2 size={16} className="text-neutral-400" />
              <input className="w-full bg-transparent outline-none" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder={brandConfig.ownerTeamPlaceholder} required />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-neutral-700">Tipo mezzo / preset</label>
            <select className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3 outline-none" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="auto">Auto</option>
              <option value="moto">Moto</option>
              <option value="kart">Kart</option>
              <option value="formula">Formula</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500 disabled:opacity-60">
            {loading ? "Creazione workspace..." : "Crea workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
