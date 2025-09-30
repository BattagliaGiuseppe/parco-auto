"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@supabase/auth-helpers-react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      router.push("/login");
    } else {
      setLoading(false);
    }
  }, [session, router]);

  if (loading) {
    return <div className="p-6">Caricamento...</div>;
  }

  return <>{children}</>;
}
