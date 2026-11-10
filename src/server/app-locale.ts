import "server-only";
import { makeT, tr, type AppLocale } from "@/lib/i18n/app";
import { requireUser } from "@/server/context";

/** Langue de l'espace pro pour l'utilisateur connecté. */
export async function appLocale(): Promise<AppLocale> {
  return (await requireUser()).locale === "en" ? "en" : "fr";
}

/** `const t = await appT(); t("Factures")` dans une page serveur de l'espace pro. */
export async function appT() {
  return makeT(await appLocale());
}

/** Titre d'onglet traduit : `export const generateMetadata = appMetadata("Factures");` */
export function appMetadata(title: string) {
  return async () => ({ title: tr(title, await appLocale()) });
}
