import "server-only";
import { cache } from "react";
import { makeT, tr, type AppLocale } from "@/lib/i18n/app";
import { getSessionUser } from "@/server/auth/session";

/** Langue de l'espace pro pour l'utilisateur connecté (français pour un visiteur : jamais de redirection). */
export const appLocale = cache(async (): Promise<AppLocale> => ((await getSessionUser())?.user.locale === "en" ? "en" : "fr"));

/** `const t = await appT(); t("Factures")` dans une page serveur de l'espace pro. */
export async function appT() {
  return makeT(await appLocale());
}

/** Titre d'onglet traduit : `export const generateMetadata = appMetadata("Factures");` */
export function appMetadata(title: string) {
  return async () => ({ title: tr(title, await appLocale()) });
}
