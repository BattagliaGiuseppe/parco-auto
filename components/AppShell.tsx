"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/components/Sidebar";

const publicRoutes = ["/login"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    let active = true;

    async function boot() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      const logged = !!session;
      setIsAuthenticated(logged);

      if (!logged) {
        setNeedsOnboarding(false);
        if (!publicRoutes.includes(pathname)) router.replace("/login");
        setReady(true);
        return;
      }

      const { data: teamUser } = await supabase
        .from("team_users")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!active) return;

      const onboarding = !teamUser;
      setNeedsOnboarding(onboarding);

      if (onboarding && pathname !== "/onboarding") {
        router.replace("/onboarding");
      } else if (!onboarding && (pathname === "/login" || pathname === "/onboarding" || pathname === "/")) {
        router.replace("/dashboard");
      }

      setReady(true);
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const logged = !!session;
      setIsAuthenticated(logged);
      if (!logged) {
        setNeedsOnboarding(false);
        router.replace("/login");
        return;
      }

      const { data: teamUser } = await supabase
        .from("team_users")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .eq("is_active", true)
        .maybeSingle();

      const onboarding = !teamUser;
      setNeedsOnboarding(onboarding);
      if (onboarding) router.replace("/onboarding");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-100 text-neutral-500">Caricamento...</div>;
  }

  const showShell = isAuthenticated && !needsOnboarding && !publicRoutes.includes(pathname) && pathname !== "/onboarding";

  if (!showShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 lg:grid lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <main className="min-w-0">
        <div className="mx-auto max-w-[1800px] p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
