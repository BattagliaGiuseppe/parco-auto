"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

type ToastState = {
  show: boolean;
  message: string;
  type: "success" | "error";
};

export default function NewDriverPage() {
  const router = useRouter();

  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [toast, setToast] = useState<ToastState>({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type });
    window.setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  const saveDriver = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast("Compila nome e cognome", "error");
      return;
    }

    try {
      setSaving(true);

      const ctx = await getCurrentTeamContext();

      const { data, error } = await supabase
        .from("drivers")
        .insert([
          {
            team_id: ctx.teamId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            nickname: nickname.trim() || null,
            birth_date: birthDate || null,
            nationality: nationality.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            emergency_contact: emergencyContact.trim() || null,
            notes: notes.trim() || null,
            is_active: isActive,
          },
        ])
        .select("id")
        .single();

      if (error) throw error;

      showToast("Pilota creato correttamente");
      router.push(`/drivers/${data.id}`);
    } catch (error: any) {
      console.error("Errore creazione pilota:", error);
      showToast(error.message || "Errore durante la creazione del pilota", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${audiowide.className}`}>
      <section className="card-base overflow-hidden">
        <div className="bg-black text-yellow-500 px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                <UserRound size={14} />
                Creazione pilota
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-yellow-400">
                Nuovo pilota
              </h1>

              <p className="text-yellow-100/75 text-sm mt-2">
                Inserisci l’anagrafica base del pilota. Licenze e documenti li aggiungerai nella scheda dettaglio.
              </p>
            </div>

            <Link
              href="/drivers"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-yellow-400 font-semibold"
            >
              <ArrowLeft size={16} /> Torna ai piloti
            </Link>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome *">
              <input
                className="input-base"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Es. Giuseppe"
              />
            </Field>

            <Field label="Cognome *">
              <input
                className="input-base"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Es. Battaglia"
              />
            </Field>

            <Field label="Nickname">
              <input
                className="input-base"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Es. Peppino"
              />
            </Field>

            <Field label="Data di nascita">
              <input
                type="date"
                className="input-base"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </Field>

            <Field label="Nazionalità">
              <input
                className="input-base"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="Es. Italiana"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                className="input-base"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@email.com"
              />
            </Field>

            <Field label="Telefono">
              <input
                className="input-base"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Es. +39..."
              />
            </Field>

            <Field label="Contatto emergenza">
              <input
                className="input-base"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Nome e numero"
              />
            </Field>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-5 w-5"
              />
              <span className="font-medium text-neutral-800">Pilota attivo</span>
            </label>
          </div>

          <div className="mt-4">
            <Field label="Note">
              <textarea
                className="input-base min-h-[130px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note interne sul pilota..."
              />
            </Field>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button onClick={saveDriver} disabled={saving} className="btn-primary">
              <Save size={18} />
              {saving ? "Salvataggio..." : "Crea pilota"}
            </button>

            <Link href="/drivers" className="btn-secondary">
              Annulla
            </Link>
          </div>
        </div>
      </section>

      {toast.show && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-lg font-semibold ${
            toast.type === "success"
              ? "bg-yellow-400 text-black"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}