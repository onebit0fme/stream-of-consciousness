import type { AuthRequest, ClientInfo } from "@cloudflare/workers-oauth-provider";

export class OAuthError extends Error {
  constructor(
    public code: string,
    public description: string,
    public statusCode = 400,
  ) {
    super(description);
    this.name = "OAuthError";
  }

  toResponse(): Response {
    return new Response(
      JSON.stringify({ error: this.code, error_description: this.description }),
      { status: this.statusCode, headers: { "Content-Type": "application/json" } },
    );
  }
}

export function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeUrl(url: string): string {
  const normalized = url.trim();
  if (!normalized) return "";
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.charCodeAt(i);
    if ((c >= 0x00 && c <= 0x1f) || (c >= 0x7f && c <= 0x9f)) return "";
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return "";
  }
  const scheme = parsed.protocol.slice(0, -1).toLowerCase();
  return scheme === "https" || scheme === "http" ? normalized : "";
}

const CSRF_COOKIE = "__Host-CSRF_TOKEN";
const CONSENTED_STATE_COOKIE = "__Host-CONSENTED_STATE";
const APPROVED_CLIENTS_COOKIE = "__Host-APPROVED_CLIENTS";

export function generateCSRFProtection(): { token: string; setCookie: string } {
  const token = crypto.randomUUID();
  const setCookie = `${CSRF_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;
  return { token, setCookie };
}

export function validateCSRFToken(formData: FormData, request: Request): { clearCookie: string } {
  const tokenFromForm = formData.get("csrf_token");
  if (!tokenFromForm || typeof tokenFromForm !== "string") {
    throw new OAuthError("invalid_request", "Missing CSRF token in form data", 400);
  }
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const csrfCookie = cookies.find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  const tokenFromCookie = csrfCookie ? csrfCookie.substring(CSRF_COOKIE.length + 1) : null;
  if (!tokenFromCookie) throw new OAuthError("invalid_request", "Missing CSRF token cookie", 400);
  if (tokenFromForm !== tokenFromCookie) throw new OAuthError("invalid_request", "CSRF token mismatch", 400);
  const clearCookie = `${CSRF_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
  return { clearCookie };
}

export async function createOAuthState(
  oauthReqInfo: AuthRequest,
  kv: KVNamespace,
  stateTTL = 600,
): Promise<{ stateToken: string }> {
  const stateToken = crypto.randomUUID();
  await kv.put(`oauth:state:${stateToken}`, JSON.stringify(oauthReqInfo), {
    expirationTtl: stateTTL,
  });
  return { stateToken };
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function bindStateToSession(stateToken: string): Promise<{ setCookie: string }> {
  const hashHex = await sha256Hex(stateToken);
  return {
    setCookie: `${CONSENTED_STATE_COOKIE}=${hashHex}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`,
  };
}

export async function validateOAuthState(
  request: Request,
  kv: KVNamespace,
): Promise<{ oauthReqInfo: AuthRequest; clearCookie: string }> {
  const url = new URL(request.url);
  const stateFromQuery = url.searchParams.get("state");
  if (!stateFromQuery) throw new OAuthError("invalid_request", "Missing state parameter", 400);

  const storedJson = await kv.get(`oauth:state:${stateFromQuery}`);
  if (!storedJson) throw new OAuthError("invalid_request", "Invalid or expired state", 400);

  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const consentedCookie = cookies.find((c) => c.startsWith(`${CONSENTED_STATE_COOKIE}=`));
  const consentedHash = consentedCookie ? consentedCookie.substring(CONSENTED_STATE_COOKIE.length + 1) : null;
  if (!consentedHash) {
    throw new OAuthError("invalid_request", "Missing session binding cookie — restart auth", 400);
  }

  const computed = await sha256Hex(stateFromQuery);
  if (computed !== consentedHash) {
    throw new OAuthError("invalid_request", "State does not match session — possible CSRF", 400);
  }

  let oauthReqInfo: AuthRequest;
  try {
    oauthReqInfo = JSON.parse(storedJson) as AuthRequest;
  } catch {
    throw new OAuthError("server_error", "Invalid state data", 500);
  }

  await kv.delete(`oauth:state:${stateFromQuery}`);
  const clearCookie = `${CONSENTED_STATE_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
  return { oauthReqInfo, clearCookie };
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error("cookieSecret is required");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

async function signData(data: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifySignature(sigHex: string, data: string, secret: string): Promise<boolean> {
  try {
    const key = await importHmacKey(secret);
    const bytes = new Uint8Array(sigHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    return await crypto.subtle.verify("HMAC", key, bytes.buffer, new TextEncoder().encode(data));
  } catch {
    return false;
  }
}

async function getApprovedClientsFromCookie(request: Request, secret: string): Promise<string[] | null> {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const targetCookie = cookies.find((c) => c.startsWith(`${APPROVED_CLIENTS_COOKIE}=`));
  if (!targetCookie) return null;
  const cookieValue = targetCookie.substring(APPROVED_CLIENTS_COOKIE.length + 1);
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [sigHex, b64Payload] = parts;
  const payload = atob(b64Payload);
  if (!(await verifySignature(sigHex, payload, secret))) return null;
  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

export async function isClientApproved(request: Request, clientId: string, secret: string): Promise<boolean> {
  const approved = await getApprovedClientsFromCookie(request, secret);
  return approved?.includes(clientId) ?? false;
}

export async function addApprovedClient(request: Request, clientId: string, secret: string): Promise<string> {
  const THIRTY_DAYS = 2592000;
  const existing = (await getApprovedClientsFromCookie(request, secret)) ?? [];
  const updated = Array.from(new Set([...existing, clientId]));
  const payload = JSON.stringify(updated);
  const sig = await signData(payload, secret);
  return `${APPROVED_CLIENTS_COOKIE}=${sig}.${btoa(payload)}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${THIRTY_DAYS}`;
}

export interface ApprovalDialogOptions {
  client: ClientInfo | null;
  server: { name: string; description?: string; logo?: string };
  state: Record<string, unknown>;
  csrfToken: string;
  setCookie: string;
}

export function renderApprovalDialog(request: Request, options: ApprovalDialogOptions): Response {
  const { client, server, state, csrfToken, setCookie } = options;
  const encodedState = btoa(JSON.stringify(state));

  const serverName = sanitizeText(server.name);
  const serverDescription = server.description ? sanitizeText(server.description) : "";
  const logoUrl = server.logo ? sanitizeText(sanitizeUrl(server.logo)) : "";
  const clientName = client?.clientName ? sanitizeText(client.clientName) : "Unknown MCP Client";
  const clientUri = client?.clientUri ? sanitizeText(sanitizeUrl(client.clientUri)) : "";
  const redirectUris = client?.redirectUris
    ? client.redirectUris.map((u) => sanitizeText(sanitizeUrl(u))).filter(Boolean)
    : [];

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${clientName} | Authorization Request</title>
<style>
:root{--primary:#0070f3;--border:#e5e7eb;--text:#333;--bg:#fff}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:var(--text);background:#f9fafb;margin:0;padding:0}
.container{max-width:600px;margin:2rem auto;padding:1rem}
.precard{padding:2rem;text-align:center}
.card{background:var(--bg);border-radius:8px;box-shadow:0 8px 36px 8px rgba(0,0,0,.1);padding:2rem}
.header{display:flex;align-items:center;justify-content:center;margin-bottom:1.5rem}
.logo{width:48px;height:48px;margin-right:1rem;border-radius:8px}
.title{margin:0;font-size:1.3rem;font-weight:400}
.alert{margin:1rem 0;font-size:1.5rem;font-weight:400;text-align:center}
.description{color:#555}
.client-info{border:1px solid var(--border);border-radius:6px;padding:1rem 1rem .5rem;margin-bottom:1.5rem}
.client-detail{display:flex;margin-bottom:.5rem;align-items:baseline}
.detail-label{font-weight:500;min-width:120px}
.detail-value{font-family:SFMono-Regular,Menlo,Monaco,Consolas,monospace;word-break:break-all}
.detail-value.small{font-size:.8em}
.detail-value a{color:inherit;text-decoration:underline}
.actions{display:flex;justify-content:flex-end;gap:1rem;margin-top:2rem}
.button{padding:.75rem 1.5rem;border-radius:6px;font-weight:500;cursor:pointer;border:none;font-size:1rem}
.button-primary{background:var(--primary);color:#fff}
.button-secondary{background:transparent;border:1px solid var(--border);color:var(--text)}
@media (max-width:640px){.container{margin:1rem auto;padding:.5rem}.card{padding:1.5rem}.client-detail{flex-direction:column}.detail-label{min-width:unset;margin-bottom:.25rem}.actions{flex-direction:column}.button{width:100%}}
</style></head><body>
<div class="container">
  <div class="precard">
    <div class="header">
      ${logoUrl ? `<img src="${logoUrl}" alt="${serverName}" class="logo">` : ""}
      <h1 class="title"><strong>${serverName}</strong></h1>
    </div>
    ${serverDescription ? `<p class="description">${serverDescription}</p>` : ""}
  </div>
  <div class="card">
    <h2 class="alert"><strong>${clientName}</strong> is requesting access</h2>
    <div class="client-info">
      <div class="client-detail"><div class="detail-label">Name:</div><div class="detail-value">${clientName}</div></div>
      ${clientUri ? `<div class="client-detail"><div class="detail-label">Website:</div><div class="detail-value small"><a href="${clientUri}" target="_blank" rel="noopener noreferrer">${clientUri}</a></div></div>` : ""}
      ${redirectUris.length ? `<div class="client-detail"><div class="detail-label">Redirect URIs:</div><div class="detail-value small">${redirectUris.map((u) => `<div>${u}</div>`).join("")}</div></div>` : ""}
    </div>
    <p>This MCP client is requesting access to your Todoist account through ${serverName}. If you approve, you'll be redirected to Todoist to sign in.</p>
    <form method="post" action="${new URL(request.url).pathname}">
      <input type="hidden" name="state" value="${encodedState}">
      <input type="hidden" name="csrf_token" value="${csrfToken}">
      <div class="actions">
        <button type="button" class="button button-secondary" onclick="window.history.back()">Cancel</button>
        <button type="submit" class="button button-primary">Approve</button>
      </div>
    </form>
  </div>
</div>
</body></html>`;

  return new Response(html, {
    headers: {
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": setCookie,
      "X-Frame-Options": "DENY",
    },
  });
}
