"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";
import { Audiowide } from "next/font/google";

const audiowide = Audiowide({ subsets: ["latin"], weight: ["400"] });

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        const isLoginPage = pathname === "/login";

        if (!session && !isLoginPage) {
          router.replace("/login");
          return;
        }

        if (session && isLoginPage) {
          router.replace("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Errore controllo auth:", error);
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    };

    check();

    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (checking && pathname !== "/login") {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-neutral-100 ${audiowide.className}`}
      >
        <div className="rounded-2xl border bg-white shadow-sm px-5 py-4 text-neutral-600 flex items-center gap-3">
          <Loader2 className="animate-spin" size={18} />
          Verifica sessione...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}