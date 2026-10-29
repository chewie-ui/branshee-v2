/**
 * Erreurs serveur de toutes les pages et actions : notées dans Admin › Santé (et alerte par email).
 * https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#onrequesterror-optional
 */
export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routerKind: string; routePath: string; routeType: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("@/server/health");
  const e = err instanceof Error ? err : new Error(String(err));
  await recordError({ source: "server", message: e.message, detail: `${request.method} ${context.routePath} (${context.routeType})\n${e.stack ?? ""}`, path: request.path });
}
