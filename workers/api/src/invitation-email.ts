type InvitationEmailEnvironment = {
  RESEND_API_KEY?: string;
  INVITATION_FROM_EMAIL?: string;
  PUBLIC_APP_URL?: string;
};

type InvitationEmailInput = {
  to: string;
  inviteCode: string;
  role: string;
  expiresAt: string;
  familyName: string;
};

export type InvitationEmailResult = { sent: true } | { sent: false; reason: "not_configured" | "provider_error" };

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export async function sendInvitationEmail(
  env: InvitationEmailEnvironment,
  invitation: InvitationEmailInput,
): Promise<InvitationEmailResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.INVITATION_FROM_EMAIL?.trim();
  const appUrl = env.PUBLIC_APP_URL?.trim();
  if (!apiKey || !from || !appUrl) return { sent: false, reason: "not_configured" };

  let invitationUrl: URL;
  try {
    invitationUrl = new URL("/invite/" + encodeURIComponent(invitation.inviteCode), appUrl);
    if (!["https:", "http:"].includes(invitationUrl.protocol)) return { sent: false, reason: "not_configured" };
  } catch {
    return { sent: false, reason: "not_configured" };
  }

  const familyName = escapeHtml(invitation.familyName);
  const role = escapeHtml(invitation.role);
  const link = invitationUrl.toString();
  const expiry = new Date(invitation.expiresAt).toLocaleString("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  });
  const text = [
    "You have been invited to join " + invitation.familyName + " on Vansvriksh.",
    "Access level: " + invitation.role,
    "Accept your invitation: " + link,
    "This invitation expires on " + expiry + " (IST).",
    "Sign in with the Google account that received this email.",
  ].join("\n");
  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#25332d;line-height:1.6">',
    '<p style="color:#66816f;font-size:12px;letter-spacing:2px">VANSVRIKSH · FAMILY CIRCLE</p>',
    '<h1 style="font-size:26px;font-weight:600">A family story, shared.</h1>',
    "<p>You've been invited to join <strong>" + familyName + "</strong> on Vansvriksh with <strong>" + role + "</strong> access.</p>",
    '<p style="margin:28px 0"><a href="' + escapeHtml(link) + '" style="background:#315f48;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;display:inline-block">Accept invitation</a></p>',
    "<p>This secure invitation expires on " + escapeHtml(expiry) + " (IST). Sign in using the Google account that received this email.</p>",
    '<p style="font-size:12px;color:#68766d">If you weren\'t expecting this invitation, you can ignore this email.</p>',
    "</div>",
  ].join("");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [invitation.to],
        subject: "You're invited to join " + invitation.familyName + " on Vansvriksh",
        text,
        html,
      }),
    });
    return response.ok ? { sent: true } : { sent: false, reason: "provider_error" };
  } catch {
    return { sent: false, reason: "provider_error" };
  }
}
