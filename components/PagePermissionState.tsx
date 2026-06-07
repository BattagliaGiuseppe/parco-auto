"use client";

import type { ReactNode } from "react";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import EmptyState from "@/components/EmptyState";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { translateKnownText } from "@/lib/i18n";

export default function PagePermissionState({
  title,
  subtitle,
  icon,
  state,
  message,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  state: "loading" | "error" | "denied";
  message?: string;
}) {
  const { language } = useLanguage();
  const copy =
    state === "loading"
      ? {
          title: "Verifica accessi in corso",
          description:
            message || "Sto controllando i permessi del tuo profilo per questo modulo.",
        }
      : state === "error"
      ? {
          title: "Impossibile verificare i permessi",
          description:
            message || "Controlla sessione, policy e configurazione del database.",
        }
      : {
          title: "Accesso non consentito",
          description: message || "Il tuo ruolo non ha accesso a questo modulo.",
        };

  return (
    <div className="space-y-6">
      <PageHeader title={translateKnownText(title, language)} subtitle={translateKnownText(subtitle, language)} icon={icon} />
      <SectionCard>
        <EmptyState title={copy.title} description={copy.description} />
      </SectionCard>
    </div>
  );
}
