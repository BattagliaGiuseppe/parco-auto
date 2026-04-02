"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { LogIn, ShieldCheck, Mail, KeyRound, UserPlus } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

function getRedirectUrl() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/login`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const title = useMemo(() => mode === 'login' ? 'Accedi al workspace' : 'Crea il tuo account', [mode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getRedirectUrl() },
        });
        if (error) throw error;
        setMessage('Registrazione completata. Controlla la mail di conferma e poi accedi.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Errore autenticazione');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      setError('Inserisci la tua email per ricevere il reset password.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl(),
      });
      if (error) throw error;
      setMessage('Email di reset inviata.');
    } catch (err: any) {
      setError(err.message || 'Errore invio reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`grid min-h-screen lg:grid-cols-[1.1fr_0.9fr] ${audiowide.className}`}>
      <div className="hidden bg-neutral-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-yellow-400">
            <ShieldCheck size={14} /> Motorsport Operating System
          </div>
          <h1 className="mt-6 max-w-xl text-4xl font-bold leading-tight">
            La piattaforma configurabile per gestire mezzi, componenti, eventi, check tecnici e lavoro in pista.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-neutral-400">
            Multi-team, ruoli, template mezzo, dashboard operative e control center: una base pensata per officina, paddock e management.
          </p>
        </div>
        <div className="text-sm text-neutral-500">© 2026 Battaglia Racing Car · Motorsport Management Platform</div>
      </div>

      <div className="flex items-center justify-center bg-neutral-100 p-6">
        <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900">{title}</h2>
            <p className="mt-2 text-sm text-neutral-500">
              {mode === 'login'
                ? 'Entra nella piattaforma con il tuo account team.'
                : 'Crea il tuo account e configura il primo workspace.'}
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
              {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
              {loading ? 'Attendere...' : mode === 'login' ? 'Accedi' : 'Crea account'}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-3 text-sm">
            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-left font-semibold text-neutral-700 underline decoration-neutral-300 underline-offset-4">
              {mode === 'login' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
            </button>
            {mode === 'login' ? (
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
