"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const router = useRouter();
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
        <Link href="/">🏠 Home</Link>
        {session && (
          <>
            <Link href="/cars">🚗 Auto</Link>
            <Link href="/components">⚙️ Componenti</Link>
            <Link href="/maintenances">🛠️ Manutenzioni</Link>
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
            Logout
          </button>
        ) : (
          <Link href="/login" className="px-3 py-1 bg-blue-600 text-white rounded">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}
