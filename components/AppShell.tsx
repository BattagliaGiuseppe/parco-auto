"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/components/Sidebar";
import {
  clearPendingInviteToken,
  getPublicInviteByToken,
  listMyPendingTeamInvites,
  readPendingInviteToken,
  setPendingInviteToken,
} from "@/lib/teamContext";

const publicRoutes = new Set(["/login", "/onboarding", "/accept-invite"]);

type AccessStatus =
  | "loading"
  | "guest"
  | "ready"
  | "onboarding"
  | "invite"
  | "error";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>("loading");
  const [accessError, setAccessError] = useState<string | null>(null);
  const [inviteRedirectToken, setInviteRedirectToken] = useState<string | null>(null);

  const inviteRedirectHref = useMemo(() => {
    if (!inviteRedirectToken) {
      return "/accept-invite";
    }

    return `/accept-invite?token=${encodeURIComponent(inviteRedirectToken)}`;
  }, [inviteRedirectToken]);

  async function resolvePendingInviteToken(session: {
    user: { email?: string | null };
  } | null) {
    if (!session?.user?.email) {
      return null;
    }

    const normalizedSessionEmail = session.user.email.trim().toLowerCase();
    const storedToken = readPendingInviteToken();

    if (storedToken) {
      try {
        const invite = await getPublicInviteByToken(storedToken);
        const inviteEmail = invite?.email?.trim().toLowerCase();

        if (invite?.is_valid && inviteEmail === normalizedSessionEmail) {
          return storedToken;
        }
      } catch (error) {
        console.warn("Token invito locale non valido:", error);
      }

      clearPendingInviteToken();
    }

    try {
      const pendingInvites = await listMyPendingTeamInvites();
      const firstInvite = pendingInvites[0];

      if (firstInvite?.token) {
        setPendingInviteToken(firstInvite.token);
        return firstInvite.token;
      }
    } catch (error) {
      console.warn("Inviti pendenti non caricati:", error);
    }

    return null;
  }

  async function refreshAccess(
    session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
  ) {
    const logged = !!session;
    setIsAuthenticated(logged);
    setAccessError(null);
    setInviteRedirectToken(null);

    if (!logged) {
      setAccessStatus("guest");
      return;
    }

    const { data: teamUsers, error } = await supabase
      .from("team_users")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      console.error("Errore lettura team_users:", error);
      setAccessStatus("error");
      setAccessError(error.message || "Errore durante la verifica del workspace.");
      return;
    }

    const hasMembership = !!teamUsers && teamUsers.length > 0;

    if (!hasMembership) {
      const inviteToken = await resolvePendingInviteToken(session);

      if (inviteToken) {
        setInviteRedirectToken(inviteToken);
        setAccessStatus("invite");
        return;
      }

      setAccessStatus("onboarding");
      return;
    }

    clearPendingInviteToken();
    setAccessStatus("ready");
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;
        await refreshAccess(session);
      } catch (error) {
        console.error("Errore bootstrap AppShell:", error);

        if (!active) return;

        setIsAuthenticated(false);
        setAccessStatus("guest");
        setAccessError(null);
        setInviteRedirectToken(null);
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        try {
          if (!active) return;
          await refreshAccess(session);
        } catch (error) {
          console.error("Errore auth state change:", error);

          if (!active) return;

          setAccessStatus("error");
          setAccessError("Errore durante l'aggiornamento della sessione.");
        } finally {
          if (active) {
            setReady(true);
          }
        }
      })();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!isAuthenticated) {
      if (!publicRoutes.has(pathname)) {
        router.replace("/login");
      }
      return;
    }

    if (accessStatus === "invite") {
      const currentToken = searchParams.get("token");

      if (pathname !== "/accept-invite" || currentToken !== inviteRedirectToken) {
        router.replace(inviteRedirectHref);
      }
      return;
    }

    if (accessStatus === "onboarding") {
      if (pathname !== "/onboarding") {
        router.replace("/onboarding");
      }
      return;
    }

    if (
      accessStatus === "ready" &&
      (pathname === "/login" || pathname === "/onboarding" || pathname === "/")
    ) {
      router.replace("/dashboard");
    }
  }, [
    accessStatus,
    inviteRedirectHref,
    inviteRedirectToken,
    isAuthenticated,
    pathname,
    ready,
    router,
    searchParams,
  ]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready || accessStatus === "loading") {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center text-neutral-500">
        Caricamento...
      </div>
    );
  }

  if (isAuthenticated && accessStatus === "error") {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-3xl border border-neutral-200 bg-white p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-neutral-900">
            Impossibile verificare il workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            L&apos;account risulta autenticato, ma la piattaforma non riesce a
            controllare correttamente l&apos;accesso al team. Non significa per
            forza che il workspace non esista: potrebbe essere un problema
            temporaneo di query, permessi o policy.
          </p>

          {accessError ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {accessError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-4 py-3 font-bold text-black hover:bg-yellow-500"
            >
              Riprova
            </button>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center justify-center rounded-2xl border border-neutral-200 px-4 py-3 font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Esci
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showShell =
    isAuthenticated &&
    accessStatus === "ready" &&
    !publicRoutes.has(pathname);

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-neutral-100 lg:grid lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <main className="min-w-0 p-4 md:p-6">{children}</main>
    </div>
  );
}
