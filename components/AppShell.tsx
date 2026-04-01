"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <main className="min-w-0">
          <div className="min-h-screen bg-gradient-to-b from-neutral-100 to-neutral-200/60">
            <div className="mx-auto w-full max-w-[1800px] p-4 md:p-6 lg:p-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
