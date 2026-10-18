import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Identité d'une requête de l'application (mobile ou bureau), posée par l'API après vérification du jeton.
 * `getSessionUser` et le contexte de l'espace pro la lisent à la place du cookie : les actions du site
 * (droits, limites du forfait, journal, emails) s'appliquent donc à l'identique depuis l'application.
 */
export type ApiAuth = { userId: string; sessionId: string; businessId: string | null };
export const apiAuth = new AsyncLocalStorage<ApiAuth>();
