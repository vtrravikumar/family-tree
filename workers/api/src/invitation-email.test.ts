import { afterEach, describe, expect, it, vi } from "vitest";
import { sendInvitationEmail } from "./invitation-email";

const invitation = {
  to: "relative@example.com",
  inviteCode: "secure-token-value",
  role: "viewer",
  expiresAt: "2026-12-02T10:00:00.000Z",
  familyName: "The Example Family",
};

afterEach(() => vi.unstubAllGlobals());

describe("Resend invitation email delivery", () => {
  it("does not call the provider when configuration is incomplete", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendInvitationEmail({ PUBLIC_APP_URL: "https://vansvriksh.vtrrk.in" }, invitation);
    expect(result).toEqual({ sent: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a branded invitation with the secure acceptance link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendInvitationEmail({
      RESEND_API_KEY: "test-resend-key",
      INVITATION_FROM_EMAIL: "Vansvriksh <invites@example.com>",
      PUBLIC_APP_URL: "https://vansvriksh.vtrrk.in",
    }, invitation);
    expect(result).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-resend-key");
    const payload = JSON.parse(String(init.body)) as { to: string[]; html: string; text: string };
    expect(payload.to).toEqual(["relative@example.com"]);
    expect(payload.html).toContain("https://vansvriksh.vtrrk.in/invite/secure-token-value");
    expect(payload.text).toContain("secure-token-value");
  });

  it("reports provider errors without throwing or losing the invitation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("provider error", { status: 503 })));
    const result = await sendInvitationEmail({
      RESEND_API_KEY: "test-resend-key",
      INVITATION_FROM_EMAIL: "Vansvriksh <invites@example.com>",
      PUBLIC_APP_URL: "https://vansvriksh.vtrrk.in",
    }, invitation);
    expect(result).toEqual({ sent: false, reason: "provider_error" });
  });

  it("handles network failures without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    const result = await sendInvitationEmail({
      RESEND_API_KEY: "test-resend-key",
      INVITATION_FROM_EMAIL: "Vansvriksh <invites@example.com>",
      PUBLIC_APP_URL: "https://vansvriksh.vtrrk.in",
    }, invitation);
    expect(result).toEqual({ sent: false, reason: "provider_error" });
  });
});
