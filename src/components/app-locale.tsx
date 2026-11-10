"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type AppLocale } from "@/lib/i18n/app";

/** Langue de l'espace pro, pour les composants client : `const t = useT(); t("Enregistrer")`. */
const Ctx = createContext<AppLocale>("fr");

export function AppLocaleProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export const useAppLocale = () => useContext(Ctx);

export function useT() {
  const locale = useContext(Ctx);
  return useMemo(() => makeT(locale), [locale]);
}

/**
 * Texte traduit selon la langue de l'espace pro, utilisable dans un composant serveur comme client :
 * `<Tx>{"Enregistrer"}</Tx>`. Sert aux briques communes (Field, CardHeader, PageHeader, Button…),
 * qui traduisent ainsi d'elles-mêmes les textes qu'on leur passe.
 */
export function Tx({ children }: { children: ReactNode }) {
  const t = useT();
  return <>{typeof children === "string" ? t(children) : children}</>;
}
