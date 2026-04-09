export type InviteEmailPayload = {
  to: string;
  inviterEmail?: string | null;
  inviterName?: string | null;
  teamName: string;
  roleLabel: string;
  inviteLink: string;
  expiresAt?: string | null;
  note?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function buildInviteEmailSubject(params: InviteEmailPayload) {
  return `Invito a ${params.teamName} · ${params.roleLabel}`;
}

export function buildInviteEmailHtml(params: InviteEmailPayload) {
  const inviterDisplay = params.inviterName || params.inviterEmail || "Un responsabile del team";
  const safeTeamName = escapeHtml(params.teamName);
  const safeRole = escapeHtml(params.roleLabel);
  const safeInviter = escapeHtml(inviterDisplay);
  const safeInviteLink = escapeHtml(params.inviteLink);
  const safeNote = params.note ? escapeHtml(params.note) : "";
  const expiresAt = escapeHtml(formatDateTime(params.expiresAt));

  return `
    <div style="background:#f5f5f5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#171717;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:24px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.06);">
        <div style="background:#facc15;padding:24px 28px;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;color:#171717;">Parco Auto Motorsport</div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Sei stato invitato nel team ${safeTeamName}</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
            ${safeInviter} ti ha invitato a collaborare nel workspace <strong>${safeTeamName}</strong> con ruolo iniziale <strong>${safeRole}</strong>.
          </p>
          <div style="border:1px solid #e5e5e5;border-radius:18px;background:#fafafa;padding:18px 20px;margin:0 0 20px;">
            <p style="margin:0 0 8px;font-size:13px;color:#525252;text-transform:uppercase;letter-spacing:0.12em;">Scadenza invito</p>
            <p style="margin:0;font-size:16px;font-weight:700;color:#171717;">${expiresAt}</p>
          </div>
          ${params.note ? `<div style="border:1px solid #fde68a;border-radius:18px;background:#fefce8;padding:18px 20px;margin:0 0 20px;"><p style="margin:0 0 8px;font-size:13px;color:#854d0e;text-transform:uppercase;letter-spacing:0.12em;">Nota</p><p style="margin:0;font-size:15px;line-height:1.7;color:#713f12;">${safeNote}</p></div>` : ""}
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#404040;">
            Per entrare nel team usa il pulsante qui sotto. Se non hai ancora un account, potrai crearne uno con la stessa email che ha ricevuto questo invito.
          </p>
          <div style="margin:0 0 24px;">
            <a href="${safeInviteLink}" style="display:inline-block;background:#facc15;color:#171717;text-decoration:none;padding:14px 22px;border-radius:16px;font-weight:700;">Accetta invito</a>
          </div>
          <p style="margin:0 0 10px;font-size:13px;line-height:1.7;color:#737373;">Se il pulsante non funziona, copia e incolla questo link nel browser:</p>
          <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.7;color:#525252;">${safeInviteLink}</p>
        </div>
      </div>
    </div>
  `;
}

export function buildInviteEmailText(params: InviteEmailPayload) {
  const inviterDisplay = params.inviterName || params.inviterEmail || "Un responsabile del team";
  const lines = [
    `${inviterDisplay} ti ha invitato nel team ${params.teamName}.`,
    `Ruolo iniziale: ${params.roleLabel}`,
    `Scadenza invito: ${formatDateTime(params.expiresAt)}`,
  ];

  if (params.note) {
    lines.push(`Nota: ${params.note}`);
  }

  lines.push("", "Accetta invito:", params.inviteLink);
  return lines.join("\n");
}
