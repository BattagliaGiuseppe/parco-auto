"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";

export default function NewDriverPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setMessage("Inserisci almeno nome e cognome.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      const { data, error } = await supabase
        .from("drivers")
        .insert([
          {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            nickname: nickname.trim() || null,
            email: email.trim() || null,
            phone: phone.trim() || null,
            notes: notes.trim() || null,
          },
        ])
        .select("id")
        .single();

      if (error) throw error;
      router.push(`/drivers/${data.id}`);
    } catch (error: any) {
      console.error(error);
      setMessage(
        "Impossibile creare il pilota. Verifica di avere eseguito la migrazione SQL del modulo piloti."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuovo pilota"
        subtitle="Crea una nuova scheda pilota"
        icon={<UserRound size={22} />}
        actions={
          <Link href="/drivers" className="btn-secondary">
            <ArrowLeft size={16} />
            Torna ai piloti
          </Link>
        }
      />

      <SectionCard title="Anagrafica pilota" subtitle="Inserisci i dati principali">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input className="input-base" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nome *" />
          <input className="input-base" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Cognome *" />
          <input className="input-base" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname" />
          <input className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="input-base md:col-span-2" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefono" />
        </div>

        <textarea className="input-base mt-3 min-h-[140px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note interne, caratteristiche del pilota, preferenze, osservazioni..." />

        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save size={16} />
            {saving ? "Salvataggio..." : "Crea pilota"}
          </button>
          {message ? <span className="text-sm text-red-600">{message}</span> : null}
        </div>
      </SectionCard>
    </div>
  );
}
