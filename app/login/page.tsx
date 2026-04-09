"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LogIn, ShieldCheck, Mail, KeyRound, UserPlus } from "lucide-react";
import { Audiowide } from "next/font/google";
import { brandConfig } from "@/lib/brand";
import { readPendingInviteToken, setPendingInviteToken } from "@/lib/teamContext";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

function getRedirectUrl(token?: string | null) {
  if (typeof window === "undefined") return undefined;
  const url = new URL(`${window.location.origin}/login`);
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token") || readPendingInviteToken();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const title = useMemo(() => {
    if (mode === "login") {
      return inviteToken ? "Accedi per entrare nel team" : "Accedi al workspace";
    }

    return inviteToken ? "Crea account per accettare l'invito" : "Crea il tuo account";
  }, [inviteToken, mode]);

  useEffect(() => {
    if (inviteToken) {
      setPendingInviteToken(inviteToken);
    }
  }, [inviteToken]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;

      if (inviteToken) {
        router.replace(`/accept-invite?token=${encodeURIComponent(inviteToken)}`);
        return;
      }

      router.replace("/dashboard");
    });
  }, [inviteToken, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getRedirectUrl(inviteToken) },
        });
        if (error) throw error;
        setMessage(
          inviteToken
            ? "Account creato. Conferma la mail e poi accedi per entrare nel team invitato."
            : "Registrazione completata. Controlla la mail di conferma e poi accedi."
        );
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (inviteToken) {
          router.replace(`/accept-invite?token=${encodeURIComponent(inviteToken)}`);
          return;
        }

        router.replace("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Errore autenticazione");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      setError("Inserisci la tua email per ricevere il reset password.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl(inviteToken),
      });
      if (error) throw error;
      setMessage("Email di reset inviata.");
    } catch (err: any) {
      setError(err.message || "Errore invio reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`grid min-h-screen lg:grid-cols-[1.1fr_0.9fr] ${audiowide.className}`}>
      <div className="hidden bg-neutral-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-yellow-400">
            <ShieldCheck size={14} /> {brandConfig.marketingLabel}
          </div>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/10">
              <Image
                src={brandConfig.logoPath}
                alt={brandConfig.appName}
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
                unoptimized
              />
            </div>
            <div>
              <div className="text-sm uppercase tracking-[0.18em] text-neutral-400">
                {brandConfig.vendorName}
              </div>
              <div className="mt-1 text-3xl font-bold text-white">{brandConfig.appName}</div>
            </div>
          </div>
          <h1 className="mt-6 max-w-xl text-4xl font-bold leading-tight">
            {brandConfig.loginHeroTitle}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-400">
            {brandConfig.loginHeroDescription}
          </p>
        </div>
        <div className="text-sm text-neutral-500">
          © 2026 {brandConfig.copyrightName} · {brandConfig.appDescription}
        </div>
      </div>

      <div className="flex items-center justify-center bg-neutral-100 p-6">
        <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl">
          <div className="mb-6">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                <Image
                  src={brandConfig.logoPath}
                  alt={brandConfig.appName}
                  width={48}
                  height={48}
                  className="h-12 w-12 object-contain"
                  unoptimized
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                  {brandConfig.vendorName}
                </div>
                <div className="mt-1 text-lg font-bold text-neutral-900">
                  {brandConfig.appName}
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">{title}</h2>
            <p className="mt-2 text-sm text-neutral-500">
              {mode === "login"
                ? inviteToken
                  ? "Usa l'email invitata per entrare nel team assegnato."
                  : `Entra in ${brandConfig.appName} con il tuo account team.`
                : inviteToken
                  ? "Crea il tuo account con l'email invitata. Dopo la conferma potrai accettare l'invito."
                  : "Crea il tuo account e configura il primo workspace."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Email</label>
              <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                <Mail size={16} className="text-neutral-400" />
                <input type="email" className="w-full bg-transparent outline-none" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-neutral-700">Password</label>
              <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-3">
                <KeyRound size={16} className="text-neutral-400" />
                <input type="password" className="w-full bg-transparent outline-none" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            {error ? <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {message ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}

            <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500 disabled:opacity-60">
              {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
              {loading ? "Attendere..." : mode === "login" ? "Accedi" : "Crea account"}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-3 text-sm">
            <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-left font-semibold text-neutral-700 underline decoration-neutral-300 underline-offset-4">
              {mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
            </button>
            {mode === "login" ? (
              <button onClick={handleResetPassword} className="text-left font-semibold text-neutral-500 underline decoration-neutral-300 underline-offset-4">
                Password dimenticata
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
