"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { createT, getMessages, type T } from "@/i18n";
import { translateServerMessage } from "@/i18n/server-errors";

type Ctx = { locale: Locale; t: T; tr: (msg: string | null | undefined) => string };
const I18n = createContext<Ctx | null>(null);

/** Fournit la langue et la traduction aux composants clients de l'interface publique. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<Ctx>(() => ({ locale, t: createT(getMessages(locale)), tr: (m) => translateServerMessage(m, locale) }), [locale]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

/** Hors fournisseur (espace pro…), on reste en français. */
const fallback: Ctx = { locale: "fr", t: createT(getMessages("fr")), tr: (m) => m ?? "" };
export const useI18n = () => useContext(I18n) ?? fallback;
