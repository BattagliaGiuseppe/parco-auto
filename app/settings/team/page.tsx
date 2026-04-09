"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Mail,
  MailPlus,
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
import {
  TEAM_ROLE_LABELS,
  TEAM_ROLES,
  canManageTeamRole,
  createTeamInvite,
  getCurrentTeamContext,
  getCurrentTeamSettings,
  getTeamInvites,
  getTeamUsers,
  sendTeamInviteEmail,
  type TeamContext,
  type TeamInvite,
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

type MemberDraft = {
  role: string;
  is_active: boolean;
};

const OVERRIDE_MODES = [
  { value: "allow", label: "Consenti" },
  { value: "deny", label: "Nega" },
] as const;

const INVITE_STATUSES: Record<string, string> = {
  pending: "In attesa",
  accepted: "Accettato",
  revoked: "Revocato",
  expired: "Scaduto",
};

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
          ? "bg-emerald-100 text-emerald-700"
          : "bg-neutral-200 text-neutral-700"
      }`}
    >
      {active ? "Attivo" : "Disattivo"}
    </span>
  );
}

function InviteStatusBadge({ status }: { status: string }) {
  const classes =
    status === "accepted"
      ? "bg-emerald-100 text-emerald-700"
      : status === "revoked"
      ? "bg-red-100 text-red-700"
      : status === "expired"
      ? "bg-neutral-200 text-neutral-700"
      : "bg-yellow-100 text-yellow-800";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {INVITE_STATUSES[status] || status}
    </span>
  );
}

export default function TeamAccessPage() {
  const access = usePermissionAccess();
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [feedback, setFeedback] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [ctx, setCtx] = useState<TeamContext | null>(null);
  const [settings, setSettings] = useState<TeamSettings | null>(null);
  const [members, setMembers] = useState<TeamUser[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("viewer");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteExpiryDays, setInviteExpiryDays] = useState(7);
  const [savingInvite, setSavingInvite] = useState(false);
  const [sendingInviteEmailId, setSendingInviteEmailId] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);

  async function loadAll(showSpinner = false) {
    if (showSpinner) {
      setReloading(true);
    }

    setErrorMessage("");

    try {
      const currentCtx = await getCurrentTeamContext();
      const currentSettings = await getCurrentTeamSettings();
      const currentMembers = await getTeamUsers();
      const currentInvites = await getTeamInvites(currentCtx.teamId);

      const [catalog, roleRows, overrideRows] = await Promise.all([
        getPermissionCatalog(),
        getRolePermissions(),
        getTeamUserPermissionOverrides(currentMembers.map((member) => member.id)),
      ]);

      setCtx(currentCtx);
      setSettings(currentSettings);
      setMembers(currentMembers);
      setInvites(currentInvites);
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
      setCopiedInviteId(null);
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const canManageTeam = access.canManageTeam || canManageTeamRole(ctx?.role);
  const ownerCount = members.filter(
    (member) => member.role === "owner" && member.is_active
  ).length;
  const rolePermissionMap = useMemo(() => buildRolePermissionMap(rolePermissions), [rolePermissions]);
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
  const pendingInvites = invites.filter((invite) => invite.status === "pending");
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
      label: "Inviti pendenti",
      value: String(pendingInvites.length),
      icon: <MailPlus size={18} />,
    },
  ];

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

  async function handleCreateInvite() {
    if (!ctx) return;

    setSavingInvite(true);
    try {
      const invite = await createTeamInvite({
        teamId: ctx.teamId,
        email: inviteEmail.trim(),
        role: inviteRole,
        note: inviteNote.trim(),
        expiresInDays: inviteExpiryDays,
      });

      const sendResult = await sendTeamInviteEmail(invite.id);

      setInviteEmail("");
      setInviteRole("viewer");
      setInviteNote("");
      setInviteExpiryDays(7);

      if (sendResult.ok) {
        setFeedback("Invito creato e email automatica inviata correttamente.");
      } else {
        setFeedback(
          sendResult.message ||
            "Invito creato, ma l'email automatica non è configurata. Puoi comunque copiare il link manualmente."
        );
      }

      await loadAll(true);
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Errore durante la creazione dell'invito."
      );
    } finally {
      setSavingInvite(false);
    }
  }

  async function sendInviteEmail(invite: TeamInvite) {
    setSendingInviteEmailId(invite.id);

    try {
      const result = await sendTeamInviteEmail(invite.id);
      setFeedback(
        result.ok
          ? "Email invito inviata correttamente."
          : result.message ||
              "Invito presente, ma l'invio automatico email non è configurato. Puoi copiare il link manualmente."
      );
      await loadAll(true);
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Errore durante l'invio dell'email invito."
      );
    } finally {
      setSendingInviteEmailId(null);
    }
  }

  async function copyInviteLink(invite: TeamInvite) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteLink = `${origin}/accept-invite?token=${invite.token}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInviteId(invite.id);
      setFeedback("Link invito copiato negli appunti.");
    } catch (error) {
      console.error(error);
      setFeedback("Impossibile copiare il link invito.");
    }
  }

  async function revokeInvite(invite: TeamInvite) {
    setRevokingInviteId(invite.id);
    try {
      const { error } = await supabase
        .from("team_invites")
        .update({ status: "revoked" })
        .eq("id", invite.id);

      if (error) throw error;

      setFeedback("Invito revocato.");
      await loadAll(true);
    } catch (error) {
      console.error(error);
      setFeedback(
        error instanceof Error ? error.message : "Errore durante la revoca dell'invito."
      );
    } finally {
      setRevokingInviteId(null);
    }
  }

  if (access.loading) {
    return (
      <PagePermissionState
        title="Team & Accessi"
        subtitle="Modulo di governance team e permessi"
        icon={<ShieldCheck size={20} />}
        state="loading"
      />
    );
  }

  if (access.error) {
    return (
      <PagePermissionState
        title="Team & Accessi"
        subtitle="Modulo di governance team e permessi"
        icon={<ShieldCheck size={20} />}
        state="error"
        message={access.error}
      />
    );
  }

  if (!access.canManageTeam) {
    return (
      <PagePermissionState
        title="Team & Accessi"
        subtitle="Modulo di governance team e permessi"
        icon={<ShieldCheck size={20} />}
        state="denied"
        message="Solo owner e admin possono gestire ruoli, membri, inviti e override dei permessi del team."
      />
    );
  }

  if (loading) {
    return <div className="p-6 text-neutral-500">Caricamento Team & Accessi...</div>;
  }

  if (!ctx || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team & Accessi"
          subtitle="Modulo di governance team e permessi"
          icon={<ShieldCheck size={20} />}
        />
        <SectionCard>
          <EmptyState
            title="Impossibile caricare il modulo"
            description={errorMessage || "Controlla sessione, policy e configurazione database."}
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & Accessi"
        subtitle="Gestione ruoli, inviti collaboratori e override permessi del team"
        icon={<ShieldCheck size={20} />}
        actions={
          <button
            onClick={() => void loadAll(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            {reloading ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
            Aggiorna dati
          </button>
        }
      />

      {feedback ? (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
          {feedback}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <StatsGrid items={stats} />

      <SectionCard
        title="Snapshot team"
        subtitle="Contesto operativo del workspace corrente"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Team</div>
            <div className="mt-2 text-lg font-bold text-neutral-900">
              {settings.team_name || "Team senza nome"}
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              {settings.team_subtitle || "Gestione motorsport"}
            </div>
          </div>

          <div className="rounded-2xl bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Tuo ruolo</div>
            <div className="mt-2 text-lg font-bold text-neutral-900">
              {TEAM_ROLE_LABELS[ctx.role as TeamRole] || ctx.role}
            </div>
            <div className="mt-1 text-sm text-neutral-500">Gestione team corrente</div>
          </div>

          <div className="rounded-2xl bg-neutral-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Nuovo flusso utenti</div>
            <div className="mt-2 text-sm leading-6 text-neutral-700">
              I collaboratori entrano nel team solo tramite invito. L&apos;onboarding workspace resta riservato all&apos;owner iniziale.
            </div>
          </div>
        </div>
      </SectionCard>

      {!canManageTeam ? (
        <SectionCard>
          <EmptyState
            title="Accesso limitato"
            description="Solo owner e admin possono modificare ruoli, inviti, stato membri e override dei permessi."
          />
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Invita collaboratore"
            subtitle="Genera un link sicuro associato a email e ruolo. Il collaboratore non crea il workspace: accetta solo l'invito ricevuto."
          >
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <label className="block text-sm font-semibold text-neutral-700">
                  <div className="mb-1">Email invitata</div>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="meccanico@team.com"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-yellow-400"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold text-neutral-700">
                    <div className="mb-1">Ruolo iniziale</div>
                    <select
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value as TeamRole)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-yellow-400"
                    >
                      {TEAM_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {TEAM_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-neutral-700">
                    <div className="mb-1">Scadenza link</div>
                    <select
                      value={inviteExpiryDays}
                      onChange={(event) => setInviteExpiryDays(Number(event.target.value))}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-yellow-400"
                    >
                      <option value={3}>3 giorni</option>
                      <option value={7}>7 giorni</option>
                      <option value={14}>14 giorni</option>
                      <option value={30}>30 giorni</option>
                    </select>
                  </label>
                </div>

                <label className="block text-sm font-semibold text-neutral-700">
                  <div className="mb-1">Nota interna opzionale</div>
                  <textarea
                    value={inviteNote}
                    onChange={(event) => setInviteNote(event.target.value)}
                    rows={3}
                    placeholder="Es. Ingegnere pista per campionato 2026"
                    className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-yellow-400"
                  />
                </label>

                <button
                  onClick={() => void handleCreateInvite()}
                  disabled={savingInvite || !inviteEmail.trim()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-bold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingInvite ? <Loader2 size={16} className="animate-spin" /> : <MailPlus size={16} />}
                  Crea invito
                </button>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Nota operativa</div>
                <div className="mt-3">
                  L&apos;invito salva già team, ruolo e scadenza. Il collaboratore potrà entrare solo con l&apos;email invitata e non potrà configurare il workspace del team.
                </div>
                <div className="mt-4 rounded-2xl bg-white p-4 text-neutral-600">
                  Dopo la creazione, il sistema prova a inviare automaticamente l&apos;email di invito. Se l&apos;invio non è configurato o fallisce, il link resta comunque disponibile da copiare manualmente.
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Inviti team"
            subtitle="Storico inviti generati per il workspace corrente"
          >
            {invites.length === 0 ? (
              <EmptyState
                title="Nessun invito presente"
                description="Crea il primo invito per aggiungere un collaboratore al team senza farlo passare dall'onboarding workspace."
              />
            ) : (
              <div className="space-y-4">
                {invites.map((invite) => {
                  const canRevoke = invite.status === "pending";
                  const isRevoking = revokingInviteId === invite.id;
                  const isSendingInviteEmail = sendingInviteEmailId === invite.id;

                  return (
                    <div
                      key={invite.id}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-bold text-neutral-900 break-all">{invite.email}</div>
                            <InviteStatusBadge status={invite.status} />
                          </div>
                          <div className="mt-1 text-sm text-neutral-500">
                            Ruolo: {TEAM_ROLE_LABELS[invite.role as TeamRole] || invite.role}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-500">
                            <span>Creato: {formatDate(invite.created_at)}</span>
                            <span>Scade: {formatDate(invite.expires_at)}</span>
                            {invite.note ? <span>Nota: {invite.note}</span> : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {canRevoke ? (
                            <button
                              onClick={() => void sendInviteEmail(invite)}
                              disabled={isSendingInviteEmail}
                              className="inline-flex items-center gap-2 rounded-xl border border-yellow-200 bg-white px-3 py-2 text-sm font-semibold text-yellow-800 hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSendingInviteEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                              Invia email
                            </button>
                          ) : null}

                          <button
                            onClick={() => void copyInviteLink(invite)}
                            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
                          >
                            {copiedInviteId === invite.id ? <CheckCircle2 size={14} /> : <Link2 size={14} />}
                            {copiedInviteId === invite.id ? "Copiato" : "Copia link"}
                          </button>

                          {canRevoke ? (
                            <button
                              onClick={() => void revokeInvite(invite)}
                              disabled={isRevoking}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isRevoking ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                              Revoca
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Membri del team"
            subtitle="Aggiorna ruolo operativo e stato attivo dei membri già collegati al workspace"
          >
            {members.length === 0 ? (
              <EmptyState
                title="Nessun membro trovato"
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
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-bold text-neutral-900">
                              {member.name || member.email || "Utente senza nome"}
                            </div>
                            <MemberStatusBadge active={draft.is_active} />
                          </div>
                          <div className="mt-1 text-sm text-neutral-500 break-all">
                            {member.email || "Email non disponibile"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-500">
                            <span>ID membro: {member.id}</span>
                            <span>Creato: {formatDate(member.created_at)}</span>
                            {member.id === ctx.teamUserId ? <span>Account corrente</span> : null}
                          </div>
                        </div>

                        <div className="grid w-full gap-3 md:grid-cols-3 xl:w-auto xl:min-w-[520px]">
                          <label className="text-sm font-semibold text-neutral-700">
                            <div className="mb-1">Ruolo</div>
                            <select
                              value={draft.role}
                              onChange={(event) => patchMemberDraft(member.id, { role: event.target.value })}
                              disabled={isSaving}
                              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-yellow-400"
                            >
                              {TEAM_ROLES.map((role) => (
                                <option key={role} value={role} disabled={isLastOwner && role !== "owner"}>
                                  {TEAM_ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                            {disableOwnerDowngrade ? (
                              <div className="mt-1 text-xs text-red-500">Ultimo owner attivo: non puoi degradarlo.</div>
                            ) : null}
                          </label>

                          <label className="flex items-end gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-700">
                            <input
                              type="checkbox"
                              checked={draft.is_active}
                              onChange={(event) => patchMemberDraft(member.id, { is_active: event.target.checked })}
                              disabled={isSaving || disableOwnerDeactivate}
                              className="h-4 w-4 rounded border-neutral-300 text-yellow-500 focus:ring-yellow-400"
                            />
                            <span>Utente attivo</span>
                          </label>

                          <button
                            onClick={() => void saveMember(member)}
                            disabled={isSaving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <UserCog size={16} />}
                            Salva membro
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Matrice ruoli standard"
            subtitle="Permessi base derivati da role_permissions"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {TEAM_ROLES.map((role) => {
                const permissions = Array.from(rolePermissionMap[role] || []).sort();
                return (
                  <div key={role} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                    <div className="text-sm font-bold text-neutral-900">{TEAM_ROLE_LABELS[role]}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {permissions.length === 0 ? (
                        <span className="text-sm text-neutral-500">Nessun permesso base</span>
                      ) : (
                        permissions.map((permissionCode) => (
                          <span
                            key={`${role}-${permissionCode}`}
                            className="inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-800"
                          >
                            {permissionCode}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Override permessi per singolo membro"
            subtitle="Aggiungi eccezioni rispetto al ruolo standard"
          >
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="text-sm font-semibold text-neutral-700">
                    <div className="mb-1">Membro</div>
                    <select
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-400"
                    >
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name || member.email || member.id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-neutral-700">
                    <div className="mb-1">Permesso</div>
                    <select
                      value={selectedPermissionCode}
                      onChange={(event) => setSelectedPermissionCode(event.target.value)}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-400"
                    >
                      {permissionCatalog.map((permission) => (
                        <option key={permission.code} value={permission.code}>
                          {permission.label || permission.code}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-neutral-700">
                    <div className="mb-1">Azione</div>
                    <select
                      value={selectedOverrideMode}
                      onChange={(event) =>
                        setSelectedOverrideMode(event.target.value as "allow" | "deny")
                      }
                      className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-yellow-400"
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
                    className="inline-flex items-center gap-2 rounded-2xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingOverride ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    Salva override
                  </button>

                  <div className="text-sm text-neutral-500">
                    Gli override restano associati al membro selezionato anche se il ruolo cambia.
                  </div>
                </div>

                {selectedMemberOverrides.length === 0 ? (
                  <EmptyState
                    title="Nessun override attivo"
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
                          className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <div className="font-semibold text-neutral-900">
                              {permission?.label || override.permission_code}
                            </div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {override.permission_code}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                override.is_allowed
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {override.is_allowed ? "Consentito" : "Negato"}
                            </span>

                            <button
                              onClick={() => void deleteOverride(override.id)}
                              disabled={isDeleting}
                              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60"
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

              <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                    Permessi effettivi membro
                  </div>
                  <div className="mt-2 text-lg font-bold text-neutral-900">
                    {selectedMember?.name || selectedMember?.email || "Seleziona un membro"}
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">
                    Ruolo base: {selectedMember ? TEAM_ROLE_LABELS[selectedMember.role as TeamRole] || selectedMember.role : "—"}
                  </div>
                </div>

                {selectedMemberEffectivePermissions.length === 0 ? (
                  <EmptyState
                    title="Nessun permesso disponibile"
                    description="Controlla role_permissions oppure gli override di questo membro."
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedMemberEffectivePermissions.map((code) => (
                      <span
                        key={code}
                        className="inline-flex rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-800"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}

                <div className="rounded-2xl bg-white p-4 text-sm leading-6 text-neutral-600">
                  Per far funzionare questo modulo lato database, esegui anche il file <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">db/team_access_patch.sql</code>, poi il nuovo file <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">db/team_invites_patch.sql</code> incluso nello zip.
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Nota prodotto"
            subtitle="Prossimo step commerciale consigliato"
          >
            <div className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
              <UserX className="mt-0.5 shrink-0" size={18} />
              <div>
                Il flusso collaboratori adesso è corretto: i membri entrano dal link invito e non toccano la configurazione del workspace. Il passo successivo più forte è automatizzare l&apos;invio email oppure introdurre codici attivazione per l&apos;owner principale.
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
