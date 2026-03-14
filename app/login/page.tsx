"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { LogIn, Loader2, Mail, Lock } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/dashboard");
        return;
      }

      setCheckingSession(false);
    };

    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.replace("/dashboard");
    } catch (error: any) {
      setErrorMessage(error?.message || "Errore durante il login");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div
        className={`min-h-screen bg-neutral-100 flex items-center justify-center px-4 ${audiowide.className}`}
      >
        <div className="rounded-2xl border bg-white shadow-sm p-8 text-neutral-600 flex items-center gap-3">
          <Loader2 className="animate-spin" size={20} />
          Verifica sessione...
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-neutral-100 flex items-center justify-center px-4 ${audiowide.className}`}
    >
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white shadow-xl overflow-hidden">
        <div className="bg-black text-yellow-500 px-6 py-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-yellow-300">
            <LogIn size={14} />
            Accesso sistema
          </div>

          <h1 className="mt-3 text-3xl font-bold text-yellow-400">
            Login
          </h1>

          <p className="mt-2 text-sm text-yellow-100/75">
            Accedi alla piattaforma di gestione team e parco auto.
          </p>
        </div>

        <form onSubmit={handleLogin} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="email"
                className="input-base pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@team.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="password"
                className="input-base pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Inserisci password"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            {loading ? "Accesso..." : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}