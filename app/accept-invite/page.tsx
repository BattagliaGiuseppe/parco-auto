"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Audiowide } from "next/font/google";
import {
  acceptTeamInvite,
  clearPendingInviteToken,
  getPublicInviteByToken,
  listMyPendingTeamInvites,
  readPendingInviteToken,
  setPendingInviteToken,
  setPreferredTeamUserId,
  type PublicInviteInfo,
  type TeamInvite,
} from "@/lib/teamContext";
import { brandConfig } from "@/lib/brand";
import { CheckCircle2, Loader2, Mail, Users } from "lucide-react";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

function formatDate(value?: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || readPendingInviteToken();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [invite, setInvite] = useState<PublicInviteInfo | null>(null);
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const normalizedSessionEmail = sessionEmail?.trim().toLowerCase() || null;
  const normalizedInviteEmail = invite?.email?.trim().toLowerCase() || null;
  const emailMatches = !normalizedSessionEmail || !normalizedInviteEmail
    ? false
    : normalizedSessionEmail === normalizedInviteEmail;

  useEffect(() => {
    if (token) {
      setPendingInviteToken(token);
    }
  }, [token]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        setSessionEmail(session?.user?.email ?? null);

        if (session) {
          try {
            const invites = await listMyPendingTeamInvites();
            if (!active) return;
            setPendingInvites(invites);
          } catch (error) {
            console.warn("Lista inviti pendenti non disponibile:", error);
            if (!active) return;
            setPendingInvites([]);
          }
        } else {
          setPendingInvites([]);
        }

        if (token) {
          const currentInvite = await getPublicInviteByToken(token);
          if (!active) return;
          setInvite(currentInvite);

          if (!currentInvite) {
            setError("Invito non trovato o non più disponibile.");
          }
        }
      } catch (error) {
        console.error(error);
        if (!active) return;
        setError(
          error instanceof Error
            ? error.message
            : "Errore durante il caricamento dell'invito."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user?.email ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [token]);

  const selectedPendingInvite = useMemo(() => {
    if (!token) return null;
    return pendingInvites.find((item) => item.token === token) || null;
  }, [pendingInvites, token]);

  async function handleAccept() {
    if (!token) {
      setError("Token invito mancante.");
      return;
    }

    setAccepting(true);
    setError("");
    setFeedback("");

    try {
      const accepted = await acceptTeamInvite(token);
      setPreferredTeamUserId(accepted.team_user_id);
      clearPendingInviteToken();
      setFeedback("Invito accettato correttamente. Reindirizzamento al dashboard...");
      router.replace("/dashboard");
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "Errore durante l'accettazione dell'invito."
      );
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className={`flex min-h-screen items-center justify-center bg-neutral-100 p-6 ${audiowide.className}`}>
      <div className="w-full max-w-2xl rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-yellow-400/30 text-black">
            <Image
              src={brandConfig.logoPath}
              alt={brandConfig.appName}
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
              unoptimized
            />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">{brandConfig.appName}</div>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900">Accetta invito team</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Entra nel team assegnato senza passare dalla configurazione del workspace.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-neutral-500">
            Caricamento invito...
          </div>
        ) : (
          <div className="space-y-5">
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {feedback ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {feedback}
              </div>
            ) : null}

            {invite ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Team</div>
                  <div className="mt-2 text-lg font-bold text-neutral-900">{invite.team_name}</div>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Ruolo assegnato</div>
                  <div className="mt-2 text-lg font-bold text-neutral-900">{invite.role}</div>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Scadenza</div>
                  <div className="mt-2 text-lg font-bold text-neutral-900">{formatDate(invite.expires_at)}</div>
                </div>
              </div>
            ) : null}

            {!token && pendingInvites.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                  Abbiamo trovato inviti pendenti associati al tuo account. Scegli quale aprire.
                </div>
                {pendingInvites.map((pendingInvite) => (
                  <Link
                    key={pendingInvite.id}
                    href={`/accept-invite?token=${encodeURIComponent(pendingInvite.token)}`}
                    className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 p-4 hover:border-yellow-300 hover:bg-yellow-50"
                  >
                    <div>
                      <div className="font-semibold text-neutral-900">{pendingInvite.team_name || "Team"}</div>
                      <div className="mt-1 text-sm text-neutral-500">Ruolo: {pendingInvite.role}</div>
                    </div>
                    <div className="text-sm font-semibold text-neutral-700">Apri invito</div>
                  </Link>
                ))}
              </div>
            ) : null}

            {invite && !invite.is_valid ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
                Questo invito non è più valido. Potrebbe essere già stato accettato, revocato oppure scaduto.
              </div>
            ) : null}

            {invite && invite.is_valid ? (
              <>
                {!sessionEmail ? (
                  <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                      <Mail size={16} />
                      Email invitata: {invite.email}
                    </div>
                    <div className="text-sm leading-6 text-neutral-600">
                      Per accettare l&apos;invito devi accedere oppure creare un account con la stessa email indicata sopra.
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/login?token=${encodeURIComponent(token || "")}`}
                        className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500"
                      >
                        Accedi o crea account
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                      <Users size={16} />
                      Stai usando l&apos;account: {sessionEmail}
                    </div>

                    {!emailMatches ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        Questo invito è associato a <strong>{invite.email}</strong>. Esci e accedi con l&apos;email corretta prima di procedere.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        Email verificata correttamente. Puoi entrare nel team invitato.
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={() => void handleAccept()}
                        disabled={accepting || !emailMatches}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {accepting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                        Accetta invito
                      </button>
                      {!emailMatches ? (
                        <button
                          onClick={async () => {
                            await supabase.auth.signOut();
                            router.replace(`/login?token=${encodeURIComponent(token || "")}`);
                          }}
                          className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 font-semibold text-neutral-700 hover:bg-neutral-100"
                        >
                          Esci e cambia account
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {selectedPendingInvite?.team_name && !invite ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                Invito rilevato per il team <strong>{selectedPendingInvite.team_name}</strong>. Aggiorna la pagina oppure riapri il link ricevuto.
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
