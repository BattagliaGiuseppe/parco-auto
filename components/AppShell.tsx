"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/components/Sidebar";

const publicRoutes = ["/login", "/onboarding"];

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  async function resolveSession(
    session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"],
    currentPath: string
  ) {
    const logged = !!session;
    setIsAuthenticated(logged);

    if (!logged) {
      setNeedsOnboarding(false);
      if (!publicRoutes.includes(currentPath)) {
        router.replace("/login");
      }
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
      setNeedsOnboarding(true);
      if (currentPath !== "/onboarding") {
        router.replace("/onboarding");
      }
      return;
    }

    const onboarding = !teamUsers || teamUsers.length === 0;
    setNeedsOnboarding(onboarding);

    if (onboarding && currentPath !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }

    if (
      !onboarding &&
      (currentPath === "/login" || currentPath === "/onboarding" || currentPath === "/")
    ) {
      router.replace("/dashboard");
    }
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;
        await resolveSession(session, pathname);
      } catch (error) {
        console.error("Errore bootstrap AppShell:", error);
        if (!active) return;

        setIsAuthenticated(false);
        setNeedsOnboarding(false);

        if (!publicRoutes.includes(pathname)) {
          router.replace("/login");
        }
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
          await resolveSession(session, pathname);
        } catch (error) {
          console.error("Errore auth state change:", error);
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
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center text-neutral-500">
        Caricamento...
      </div>
    );
  }

  const showShell =
    isAuthenticated &&
    !needsOnboarding &&
    !publicRoutes.includes(pathname);

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