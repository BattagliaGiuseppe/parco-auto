"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function Navbar() {
  const router = useRouter();
  const { t } = useLanguage();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <nav className="flex justify-between items-center p-4 shadow-md bg-gray-100 dark:bg-gray-800">
      <div className="flex gap-4">
        <Link href="/">🏠 {t("nav.home", "Home")}</Link>
        {session && (
          <>
            <Link href="/cars">🚗 {t("module.cars", "Auto")}</Link>
            <Link href="/components">⚙️ {t("module.components", "Componenti")}</Link>
            <Link href="/maintenances">🛠️ {t("module.maintenances", "Manutenzioni")}</Link>
          </>
        )}
      </div>
      <div className="flex gap-4">
        <ThemeToggle />
        {session ? (
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-red-500 text-white rounded"
          >
            {t("common.logout", "Logout")}
          </button>
        ) : (
          <Link href="/login" className="px-3 py-1 bg-blue-600 text-white rounded">
            {t("auth.login", "Login")}
          </Link>
        )}
      </div>
    </nav>
  );
}
