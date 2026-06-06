import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildInviteEmailHtml, buildInviteEmailSubject, buildInviteEmailText } from "@/lib/inviteEmail";
import { brandConfig } from "@/lib/brand";

const TEAM_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  engineer: "Engineer",
  mechanic: "Mechanic",
  viewer: "Viewer",
};

function getAppBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL;

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return null;
}

function getInviteFromAddress() {
  return (
    process.env.INVITE_EMAIL_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    ""
  ).trim();
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getInviteFromAddress();

  if (!apiKey || !from) {
    return {
      ok: false as const,
      skipped: true as const,
      reason: !apiKey ? "missing_resend_api_key" : "missing_invite_email_from",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false as const,
      skipped: false as const,
      reason: "resend_request_failed",
      status: response.status,
      body,
    };
  }

  return {
    ok: true as const,
    skipped: false as const,
    id: body?.id ?? null,
  };
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";

    if (!accessToken) {
      return NextResponse.json({ error: "Token sessione mancante." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const inviteId = body?.inviteId as string | undefined;

    if (!inviteId) {
      return NextResponse.json({ error: "inviteId mancante." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Configurazione Supabase mancante." }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });
    }

    const { data: invite, error: inviteError } = await supabase
      .from("team_invites")
      .select("id, team_id, email, role, token, status, expires_at, note")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: inviteError?.message || "Invito non trovato." },
        { status: 404 }
      );
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("team_users")
      .select("id, team_id, role, email, name")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .eq("team_id", invite.team_id);

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 403 });
    }

    const managerMembership = (memberships || []).find(
      (item) => item.role === "owner" || item.role === "admin"
    );

    if (!managerMembership) {
      return NextResponse.json(
        { error: "Permessi insufficienti per inviare email di invito." },
        { status: 403 }
      );
    }

    const [{ data: teamData }, { data: inviterData }] = await Promise.all([
      supabase.from("teams").select("name").eq("id", invite.team_id).maybeSingle(),
      supabase
        .from("team_users")
        .select("name, email")
        .eq("id", managerMembership.id)
        .maybeSingle(),
    ]);

    const appBaseUrl = getAppBaseUrl();

    if (!appBaseUrl) {
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          reason: "missing_app_url",
          message:
            "Invito creato, ma manca la URL pubblica dell'app per costruire il link email.",
        },
        { status: 200 }
      );
    }

    const teamName = teamData?.name || brandConfig.defaultWorkspaceLabel;
    const roleLabel = TEAM_ROLE_LABELS[invite.role as keyof typeof TEAM_ROLE_LABELS] || invite.role;
    const inviteLink = `${appBaseUrl}/accept-invite?token=${invite.token}`;

    const subject = buildInviteEmailSubject({
      to: invite.email,
      inviterEmail: inviterData?.email || user.email || null,
      inviterName: inviterData?.name || null,
      teamName,
      roleLabel,
      inviteLink,
      expiresAt: invite.expires_at,
      note: invite.note,
    });

    const html = buildInviteEmailHtml({
      to: invite.email,
      inviterEmail: inviterData?.email || user.email || null,
      inviterName: inviterData?.name || null,
      teamName,
      roleLabel,
      inviteLink,
      expiresAt: invite.expires_at,
      note: invite.note,
    });

    const text = buildInviteEmailText({
      to: invite.email,
      inviterEmail: inviterData?.email || user.email || null,
      inviterName: inviterData?.name || null,
      teamName,
      roleLabel,
      inviteLink,
      expiresAt: invite.expires_at,
      note: invite.note,
    });

    const sendResult = await sendResendEmail({
      to: invite.email,
      subject,
      html,
      text,
    });

    if (!sendResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          skipped: sendResult.skipped,
          reason: sendResult.reason,
          message: sendResult.skipped
            ? "Invito creato, ma l'invio email automatico non è ancora configurato."
            : "Invito creato, ma l'email non è stata inviata correttamente.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Email invito inviata correttamente.",
      emailId: sendResult.id,
    });
  } catch (error) {
    console.error("POST /api/team/invites/send", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Errore durante l'invio automatico dell'email invito.",
      },
      { status: 500 }
    );
  }
}
