"use client";

import { useEffect } from "react";

export default function CarPrintPage() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="p-6 print:p-0">
      <h1 className="text-2xl font-bold">Stampa scheda auto</h1>
      <p className="text-gray-600">Vista ottimizzata per la stampa (da completare).</p>
    </div>
  );
}
