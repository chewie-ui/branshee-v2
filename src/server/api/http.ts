import "server-only";
import { headers } from "next/headers";
import { apiAuth } from "@/server/api/als";
import { verifyAccess } from "@/server/api/tokens";
import { rateLimit } from "@/server/auth/rate-limit";
import { clientIp } from "@/lib/client-ip";

/** Erreur renvoyée à l'application : `{ error, message }` avec le code HTTP. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const fail = (status: number, code: string, message: string, extra?: Record<string, unknown>): never => {
  throw new ApiError(status, code, message, extra);
};
export const notFound = (what = "Élément introuvable."): never => fail(404, "not_found", what);
export const forbidden = (): never => fail(403, "forbidden", "Votre grade ne permet pas cette action.");
export const invalid = (message: string, extra?: Record<string, unknown>): never => fail(400, "invalid", message, extra);

export type ApiRequest = {
  method: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: Record<string, unknown>;
  raw: Request;
  auth: { userId: string; sessionId: string } | null;
};
export type Handler = (r: ApiRequest) => Promise<unknown>;
export type Route = { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string; handler: Handler; public?: boolean };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data ?? { ok: true }), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.startsWith(":")) params[a[i]!.slice(1)] = decodeURIComponent(b[i]!);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** Une redirection du site (`redirect()` dans une action) devient une erreur lisible par l'application. */
function fromRedirect(e: unknown): ApiError | null {
  const digest = (e as { digest?: string })?.digest;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) return null;
  const url = digest.split(";")[2] ?? "";
  if (url.startsWith("/connexion")) return new ApiError(401, "unauthorized", "Session expirée. Reconnectez-vous.");
  if (url.startsWith("/bienvenue")) return new ApiError(409, "no_establishment", "Créez ou rejoignez d'abord un établissement.");
  if (url.startsWith("/app/acces-refuse")) return new ApiError(403, "forbidden", "Votre grade ne permet pas cette action.");
  return new ApiError(409, "redirect", "Action à terminer sur le site.", { url });
}

export async function dispatch(routes: Route[], req: Request, segments: string[]) {
  const path = "/" + segments.join("/");
  const method = req.method.toUpperCase();
  let found: { route: Route; params: Record<string, string> } | null = null;
  let pathExists = false;
  for (const route of routes) {
    const params = match(route.path, path);
    if (!params) continue;
    pathExists = true;
    if (route.method === method) {
      found = { route, params };
      break;
    }
  }
  if (!found) return json({ error: pathExists ? "method_not_allowed" : "not_found", message: "Route inconnue." }, pathExists ? 405 : 404);

  const ip = (clientIp(await headers()) ?? "local");
  if (!rateLimit(`api:${ip}`, 600, 60_000).ok) return json({ error: "rate_limited", message: "Trop de requêtes. Réessayez dans une minute." }, 429);

  const url = new URL(req.url);
  let body: Record<string, unknown> = {};
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const text = await req.text();
      const parsed = text.trim() ? JSON.parse(text) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "invalid_json", message: "Requête illisible." }, 400);
    }
  }

  let auth: ApiRequest["auth"] = null;
  if (!found.route.public) {
    const check = await verifyAccess(req.headers.get("authorization"));
    if (!check.ok) {
      const message = check.error === "token_expired" ? "Session expirée." : check.error === "token_revoked" ? "Session fermée. Reconnectez-vous." : "Authentification requise.";
      return json({ error: check.error, message }, 401);
    }
    auth = { userId: check.userId, sessionId: check.sessionId };
  }

  const request: ApiRequest = { method, params: found.params, query: url.searchParams, body, raw: req, auth };
  const companyId = url.searchParams.get("companyId");
  const run = () => found!.route.handler(request);
  try {
    const data = auth ? await apiAuth.run({ userId: auth.userId, sessionId: auth.sessionId, businessId: companyId && /^[0-9a-f-]{36}$/i.test(companyId) ? companyId : null }, run) : await run();
    // Fichier (PDF du dossier) : la route renvoie directement sa réponse.
    return data instanceof Response ? data : json(data);
  } catch (e) {
    const err = e instanceof ApiError ? e : fromRedirect(e);
    if (err) return json({ error: err.code, message: err.message, ...err.extra }, err.status);
    console.error("[api]", method, path, e);
    return json({ error: "server_error", message: "Une erreur est survenue. Réessayez." }, 500);
  }
}

/* ── Lecture des champs envoyés par l'application ── */

export const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : String(v).trim().slice(0, max));
export const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";
export const has = (body: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined;

/** FormData à partir d'un objet, pour réutiliser telles quelles les actions des formulaires du site. */
export function formData(fields: Record<string, string | number | boolean | null | undefined | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else if (typeof v === "boolean") {
      if (v) fd.set(k, "on");
    } else fd.set(k, String(v));
  }
  return fd;
}

/** Résultat d'une action du site (`{ ok, error, fieldErrors }`) → réponse ou erreur de l'API. */
export function ensureOk<T extends { ok?: boolean; error?: string | null; fieldErrors?: Record<string, string | string[] | undefined> }>(r: T | undefined | null): T {
  if (!r) return fail(400, "invalid", "Action impossible.");
  if (r.ok === false || (r.error && r.ok !== true)) {
    const fe = r.fieldErrors ? Object.values(r.fieldErrors).flat().filter(Boolean)[0] : undefined;
    return fail(400, "invalid", (r.error || fe || "Action impossible.") as string, r.fieldErrors ? { fieldErrors: r.fieldErrors } : {});
  }
  return r;
}
