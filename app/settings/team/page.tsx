"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CopyPlus,
  Info,
  Loader2,
  ShieldCheck,
  Trash2,
  Users,
  UserCog,
  UserX,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SectionCard from "@/components/SectionCard";
import StatsGrid, { type StatItem } from "@/components/StatsGrid";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabaseClient";
import { brandConfig } from "@/lib/brand";
import {
  TEAM_ROLE_LABELS,
  TEAM_ROLES,
  canManageTeamRole,
  getCurrentTeamContext,
  getCurrentTeamSettings,
  getTeamUsers,
  type TeamContext,
  type TeamRole,
  type TeamSettings,
  type TeamUser,
} from "@/lib/teamContext";
import {
  buildRolePermissionMap,
  getEffectivePermissionCodes,
  getPermissionCatalog,
  getRolePermissions,
  getTeamUserPermissionOverrides,
  type AppPermission,
  type RolePermissionRow,
  type TeamUserPermissionOverride,
  usePermissionAccess,
} from "@/lib/permissions";
import PagePermissionState from "@/components/PagePermissionState";
import FormStatusBanner from "@/components/FormStatusBanner";
import { useLanguage } from "@/components/providers/LanguageProvider";
import LocalizedText from "@/components/LocalizedText";

type MemberDraft = {
  role: string;
  is_active: boolean;
};

const OVERRIDE_MODES = [
  { value: "allow", label: "Consenti" },
  { value: "deny", label: "Nega" },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function MemberStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "border border-emerald-400/30 bg-emerald-400/12 text-emerald-200"
          : "border border-white/10 bg-white/[0.08] text-[var(--text-secondary)]"
      }`}
    >
      {active ? "Attivo" : "Disattivo"}
    </span>
  );
}

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-yellow-400/25 bg-yellow-500/10 p-4 text-sm leading-6 text-[var(--brand-accent)]">
      <div className="flex items-start gap-3">
        <Info size={18} className="mt-0.5 shrink-0" />
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function TeamAccessPage() {
  const { t } = useLanguage();
  const tr = (value: string) => t(`ui.${value}`, value);
  const access = usePermissionAccess();
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [ctx, setCtx] = useState<TeamContext | null>(null);
  const [settings, setSettings] = useState<TeamSettings | null>(null);
  const [members, setMembers] = useState<TeamUser[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<AppPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRow[]>([]);
  const [overrides, setOverrides] = useState<TeamUserPermissionOverride[]>([]);
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberDraft>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedPermissionCode, setSelectedPermissionCode] = useState<string>("");
  const [selectedOverrideMode, setSelectedOverrideMode] = useState<"allow" | "deny">("allow");
  const [savingOverride, setSavingOverride] = useState(false);
  const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null);

  async function loadAll(showSpinner = false) {
    if (showSpinner) {
      setReloading(true);
    }

    setErrorMessage("");

    try {
      const currentCtx = await getCurrentTeamContext();
      const currentSettings = await getCurrentTeamSettings();
      const currentMembers = await getTeamUsers();

      const [catalog, roleRows, overrideRows] = await Promise.all([
        getPermissionCatalog(),
        getRolePermissions(),
        getTeamUserPermissionOverrides(currentMembers.map((member) => member.id)),
      ]);

      setCtx(currentCtx);
      setSettings(currentSettings);
      setMembers(currentMembers);
      setPermissionCatalog(catalog);
      setRolePermissions(roleRows);
      setOverrides(overrideRows);
      setMemberDrafts(
        currentMembers.reduce<Record<string, MemberDraft>>((acc, member) => {
          acc[member.id] = {
            role: member.role,
            is_active: member.is_active,
          };
          return acc;
        }, {})
      );

      if (!selectedMemberId && currentMembers[0]) {
        setSelectedMemberId(currentMembers[0].id);
      } else if (
        selectedMemberId &&
        !currentMembers.some((member) => member.id === selectedMemberId)
      ) {
        setSelectedMemberId(currentMembers[0]?.id || "");
      }

      if (!selectedPermissionCode && catalog[0]) {
        setSelectedPermissionCode(catalog[0].code);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Errore durante il caricamento del modulo Team & Accessi."
      );
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }

  useEffect(() => {
    if (!access.loading && access.canManageTeam) {
      void loadAll();
    }
  }, [access.loading, access.canManageTeam]);

  useEffect(() => {
    if (!feedback) return;

    const timeout = window.setTimeout(() => {
      setFeedback("");
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  if (access.loading) {
    return (
      <PagePermissionState
        title={tr("Team & Accessi")}
        subtitle="Modulo di governance team e permessi"
        icon={<ShieldCheck size={20} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title={tr("Team & Accessi")}
        subtitle="Modulo di governance team e permessi"
        icon={<ShieldCheck size={20} />}
        state="error"
        message={access.error}
      />
    );
  }

  const canManageTeam = access.canManageTeam || canManageTeamRole(ctx?.role);
  const ownerCount = members.filter(
    (member) => member.role === "owner" && member.is_active
  ).length;

  const rolePermissionMap = buildRolePermissionMap(rolePermissions);

  const selectedMember =
    members.find((member) => member.id === selectedMemberId) || null;

  const selectedMemberOverrides = overrides.filter(
    (override) => override.team_user_id === selectedMemberId
  );

  const selectedMemberEffectivePermissions = !selectedMember
    ? []
    : getEffectivePermissionCodes({
        role: selectedMember.role,
        rolePermissions,
        overrides: selectedMemberOverrides,
      });

  const stats: StatItem[] = [
    {
      label: "Membri team",
      value: String(members.length),
      icon: <Users size={18} />,
    },
    {
      label: "Utenti attivi",
      value: String(members.filter((member) => member.is_active).length),
      icon: <CheckCircle2 size={18} />,
    },
    {
      label: "Ruoli manager",
      value: String(
        members.filter(
          (member) => member.is_active && (member.role === "owner" || member.role === "admin")
        ).length
      ),
      icon: <UserCog size={18} />,
    },
    {
      label: "Override accessi",
      value: String(overrides.length),
      icon: <ShieldCheck size={18} />,
    },
  ];

  if (!access.canManageTeam) {
    return (
      <PagePermissionState
        title={tr("Team & Accessi")}
        subtitle="Modulo di governance team e permessi"
        icon={<ShieldCheck size={20} />}
        state="denied"
        message="Solo owner e admin possono gestire ruoli, membri e override dei permessi del team."
      />
    );
  }

  function patchMemberDraft(teamUserId: string, patch: Partial<MemberDraft>) {
    setMemberDrafts((current) => ({
      ...current,
      [teamUserId]: {
        ...(current[teamUserId] || { role: "viewer", is_active: true }),
        ...patch,
      },
    }));
  }

  async function saveMember(member: TeamUser) {
    const draft = memberDrafts[member.id];
    if (!draft) return;

    const isLastOwner = member.role === "owner" && member.is_active && ownerCount <= 1;
    if (isLastOwner && (!draft.is_active || draft.role !== "owner")) {
      setFeedback("Deve restare almeno un owner attivo nel team.");
      return;
    }

    setSavingMemberId(member.id);
    try {
      const { error } = await supabase
        .from("team_users")
        .update({
          role: draft.role,
          is_active: draft.is_active,
        })
        .eq("id", member.id);

      if (error) throw error;

      setFeedback("Membro aggiornato correttamente.");
      await loadAll(true);
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio del membro."
      );
    } finally {
      setSavingMemberId(null);
    }
  }

  async function saveOverride() {
    if (!selectedMemberId || !selectedPermissionCode) {
      setFeedback("Seleziona membro e permesso prima di salvare l'override.");
      return;
    }

    setSavingOverride(true);
    try {
      const existing = overrides.find(
        (override) =>
          override.team_user_id === selectedMemberId &&
          override.permission_code === selectedPermissionCode
      );

      if (existing?.id) {
        const { error } = await supabase
          .from("team_user_permissions")
          .update({ is_allowed: selectedOverrideMode === "allow" })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_user_permissions").insert({
          team_user_id: selectedMemberId,
          permission_code: selectedPermissionCode,
          is_allowed: selectedOverrideMode === "allow",
        });

        if (error) throw error;
      }

      setFeedback("Override permesso salvato.");
      await loadAll(true);
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Errore durante il salvataggio dell'override."
      );
    } finally {
      setSavingOverride(false);
    }
  }

  async function deleteOverride(overrideId?: string) {
    if (!overrideId) return;

    setDeletingOverrideId(overrideId);
    try {
      const { error } = await supabase
        .from("team_user_permissions")
        .delete()
        .eq("id", overrideId);

      if (error) throw error;

      setFeedback("Override rimosso.");
      await loadAll(true);
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Errore durante la rimozione dell'override."
      );
    } finally {
      setDeletingOverrideId(null);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-white/10 bg-[rgba(16,23,31,0.96)] px-6 py-5 text-sm text-[var(--text-secondary)] shadow-[var(--shadow-card)]"><LocalizedText text="Caricamento Team & Accessi..." /></div>;
  }

  if (!ctx || !settings) {
    return (
      <div className={`flex flex-col gap-6 p-6`}>
        <PageHeader
          title={tr("Team & Accessi")}
          subtitle="Modulo di governance team e permessi"
          icon={<ShieldCheck size={20} />}
        />
        <SectionCard>
          <EmptyState
            title={tr("Impossibile caricare il modulo")}
            description={errorMessage || "Controlla sessione, policy e configurazione database."}
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-6 p-6`}>
      <PageHeader
        title={tr("Team & Accessi")}
        subtitle="Gestione ruoli, membri attivi e override permessi del team"
        icon={<ShieldCheck size={20} />}
        actions={
          <button
            onClick={() => void loadAll(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--brand-accent)]/50 hover:bg-white/[0.1]"
          >
            {reloading ? <Loader2 size={16} className="animate-spin" /> : <CopyPlus size={16} />}
            Aggiorna dati
          </button>
        }
      />

      {feedback ? <FormStatusBanner type="info" message={feedback} /> : null}

      {errorMessage ? <FormStatusBanner type="error" message={errorMessage} /> : null}

      <SectionCard>
        <StatsGrid items={stats} />
      </SectionCard>

      <SectionCard
        title={tr("Lettura operativa")}
        subtitle="Questo modulo governa il team attuale: ruoli, stato membri e override puntuali dei permessi."
      >
        <InfoBlock>
          Qui gestisci i membri già collegati al workspace, il loro ruolo operativo e le eventuali eccezioni ai permessi base.
          Il modulo è pensato per tenere chiara la governance del team prima di introdurre, in un passaggio successivo,
          inviti email e onboarding guidato dei nuovi utenti.
        </InfoBlock>
      </SectionCard>

      <SectionCard
        title={tr("Snapshot team")}
        subtitle="Contesto operativo del workspace corrente"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-inner">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]"><LocalizedText text="Team" /></div>
            <div className="mt-2 text-lg font-bold text-[var(--text-primary)]">
              {settings.team_name || "Team senza nome"}
            </div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]">
              {settings.team_subtitle || brandConfig.defaultTeamSubtitle}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-inner">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]"><LocalizedText text="Tuo ruolo" /></div>
            <div className="mt-2 text-lg font-bold text-[var(--text-primary)]">
              {TEAM_ROLE_LABELS[ctx.role as TeamRole] || ctx.role}
            </div>
            <div className="mt-1 text-sm text-[var(--text-secondary)]"><LocalizedText text="Gestione team corrente" /></div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-inner">
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]"><LocalizedText text="Nota operativa" /></div>
            <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Questo modulo gestisce membri già collegati al team. Per creare inviti automatici via email servirà un passo successivo dedicato.
            </div>
          </div>
        </div>
      </SectionCard>

      {!canManageTeam ? (
        <SectionCard>
          <EmptyState
            title={tr("Accesso limitato")}
            description="Solo owner e admin possono modificare ruoli, stato membri e override dei permessi."
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title={tr("Membri del team")}
            subtitle="Aggiorna ruolo operativo e stato attivo dei membri già collegati al workspace"
          >
            {members.length === 0 ? (
              <EmptyState
                title={tr("Nessun membro trovato")}
                description="Il team non ha ancora membri associati."
              />
            ) : (
              <div className="space-y-4">
                {members.map((member) => {
                  const draft = memberDrafts[member.id] || {
                    role: member.role,
                    is_active: member.is_active,
                  };
                  const isSaving = savingMemberId === member.id;
                  const isLastOwner =
                    member.role === "owner" && member.is_active && ownerCount <= 1;
                  const disableOwnerDowngrade = isLastOwner && draft.role !== "owner";
                  const disableOwnerDeactivate = isLastOwner && !draft.is_active;

                  return (
                    <div
                      key={member.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-inner"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-bold text-[var(--text-primary)]">
                              {member.name || member.email || "Utente senza nome"}
                            </div>
                            <MemberStatusBadge active={draft.is_active} />
                          </div>
                          <div className="mt-1 text-sm text-[var(--text-secondary)] break-all">
                            {member.email || "Email non disponibile"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
                            <span>ID membro: {member.id}</span>
                            <span>Creato: {formatDate(member.created_at)}</span>
                            {member.id === ctx.teamUserId ? <span><LocalizedText text="Account corrente" /></span> : null}
                          </div>
                        </div>

                        <div className="grid w-full gap-3 md:grid-cols-3 xl:w-auto xl:min-w-[520px]">
                          <label className="text-sm font-semibold text-[var(--text-secondary)]">
                            <div className="mb-1"><LocalizedText text="Ruolo" /></div>
                            <select
                              value={draft.role}
                              onChange={(event) =>
                                patchMemberDraft(member.id, { role: event.target.value })
                              }
                              className="w-full rounded-xl border border-white/15 bg-[rgba(10,16,22,0.94)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent)]/15"
                            >
                              {TEAM_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {TEAM_ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="text-sm font-semibold text-[var(--text-secondary)]">
                            <div className="mb-1"><LocalizedText text="Stato" /></div>
                            <select
                              value={draft.is_active ? "active" : "inactive"}
                              onChange={(event) =>
                                patchMemberDraft(member.id, {
                                  is_active: event.target.value === "active",
                                })
                              }
                              className="w-full rounded-xl border border-white/15 bg-[rgba(10,16,22,0.94)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent)]/15"
                            >
                              <option value="active">{tr("Attivo")}</option>
                              <option value="inactive">{tr("Disattivo")}</option>
                            </select>
                          </label>

                          <div className="flex items-end">
                            <button
                              onClick={() => void saveMember(member)}
                              disabled={isSaving || disableOwnerDowngrade || disableOwnerDeactivate}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-accent)] px-4 py-2.5 text-sm font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                              Salva membro
                            </button>
                          </div>
                        </div>
                      </div>

                      {isLastOwner ? (
                        <div className="mt-3 rounded-xl border border-yellow-400/25 bg-yellow-500/10 px-3 py-2 text-xs text-[var(--brand-accent)]">
                          Questo è l&apos;ultimo owner attivo del team: non può essere disattivato né retrocesso finché non esiste un altro owner attivo.
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={tr("Permessi base per ruolo")}
            subtitle="Matrice standard ricavata da role_permissions"
          >
            {permissionCatalog.length === 0 ? (
              <EmptyState
                title={tr("Catalogo permessi vuoto")}
                description="Controlla la tabella app_permissions o applica la patch SQL inclusa nello zip."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[var(--text-muted)]">
                      <th className="px-3 py-3 font-semibold"><LocalizedText text="Permesso" /></th>
                      {TEAM_ROLES.map((role) => (
                        <th key={role} className="px-3 py-3 font-semibold">
                          {TEAM_ROLE_LABELS[role]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {permissionCatalog.map((permission) => (
                      <tr key={permission.code} className="border-b border-white/10 align-top hover:bg-white/[0.035]">
                        <td className="px-3 py-3">
                          <div className="font-semibold text-[var(--text-primary)]">{permission.label || permission.code}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{permission.description || permission.code}</div>
                        </td>
                        {TEAM_ROLES.map((role) => {
                          const enabled = rolePermissionMap[role]?.has(permission.code) ?? false;
                          return (
                            <td key={`${permission.code}-${role}`} className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  enabled
                                    ? "border border-emerald-400/30 bg-emerald-400/12 text-emerald-200"
                                    : "border border-white/10 bg-white/[0.08] text-[var(--text-muted)]"
                                }`}
                              >
                                {enabled ? "Attivo" : "No"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={tr("Override per utente")}
            subtitle="Permette di concedere o negare eccezioni rispetto al ruolo standard"
          >
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-sm font-semibold text-[var(--text-secondary)]">
                    <div className="mb-1"><LocalizedText text="Membro" /></div>
                    <select
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-[rgba(10,16,22,0.94)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent)]/15"
                    >
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name || member.email || member.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-[var(--text-secondary)]">
                    <div className="mb-1"><LocalizedText text="Permesso" /></div>
                    <select
                      value={selectedPermissionCode}
                      onChange={(event) => setSelectedPermissionCode(event.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-[rgba(10,16,22,0.94)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent)]/15"
                    >
                      {permissionCatalog.map((permission) => (
                        <option key={permission.code} value={permission.code}>
                          {permission.label || permission.code}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-[var(--text-secondary)]">
                    <div className="mb-1"><LocalizedText text="Azione" /></div>
                    <select
                      value={selectedOverrideMode}
                      onChange={(event) =>
                        setSelectedOverrideMode(event.target.value as "allow" | "deny")
                      }
                      className="w-full rounded-xl border border-white/15 bg-[rgba(10,16,22,0.94)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-4 focus:ring-[var(--brand-accent)]/15"
                    >
                      {OVERRIDE_MODES.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void saveOverride()}
                    disabled={savingOverride || !selectedMemberId || !selectedPermissionCode}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-accent)] px-4 py-2.5 text-sm font-bold text-[var(--brand-on-accent)] hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingOverride ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    Salva override
                  </button>

                  <div className="text-sm text-[var(--text-secondary)]">
                    Gli override restano associati al membro selezionato anche se il ruolo cambia.
                  </div>
                </div>

                {selectedMemberOverrides.length === 0 ? (
                  <EmptyState
                    title={tr("Nessun override attivo")}
                    description="Il membro selezionato usa solo i permessi standard del suo ruolo."
                  />
                ) : (
                  <div className="space-y-3">
                    {selectedMemberOverrides.map((override) => {
                      const permission = permissionCatalog.find(
                        (item) => item.code === override.permission_code
                      );
                      const isDeleting = deletingOverrideId === override.id;

                      return (
                        <div
                          key={override.id || `${override.team_user_id}-${override.permission_code}`}
                          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-inner md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-semibold text-[var(--text-primary)]">
                              {permission?.label || override.permission_code}
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              {override.permission_code}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                override.is_allowed
                                  ? "border border-emerald-400/30 bg-emerald-400/12 text-emerald-200"
                                  : "border border-red-400/30 bg-red-500/12 text-red-200"
                              }`}
                            >
                              {override.is_allowed ? "Consentito" : "Negato"}
                            </span>

                            <button
                              onClick={() => void deleteOverride(override.id)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-red-400/40 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              Rimuovi
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-inner">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Permessi effettivi membro
                  </div>
                  <div className="mt-2 text-lg font-bold text-[var(--text-primary)]">
                    {selectedMember?.name || selectedMember?.email || "Seleziona un membro"}
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    Ruolo base: {selectedMember ? TEAM_ROLE_LABELS[selectedMember.role as TeamRole] || selectedMember.role : "—"}
                  </div>
                </div>

                {selectedMemberEffectivePermissions.length === 0 ? (
                  <EmptyState
                    title={tr("Nessun permesso disponibile")}
                    description="Controlla role_permissions oppure gli override di questo membro."
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedMemberEffectivePermissions.map((code) => (
                      <span
                        key={code}
                        className="inline-flex rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-[var(--brand-accent)]"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
                  Permessi, ruoli e override sono gestiti in tempo reale per il team selezionato. Le modifiche hanno effetto sul prossimo caricamento della pagina dell’utente interessato.
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={tr("Nota prodotto")}
            subtitle="Per il prossimo step commerciale"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-inner text-sm leading-6 text-[var(--text-secondary)]">
              <UserX className="mt-0.5 shrink-0" size={18} />
              <div>
                Il modulo attuale copre gestione membri, ruoli e override. Il passo successivo naturale per renderlo ancora più vendibile è aggiungere inviti email e onboarding guidato dei nuovi membri.
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
