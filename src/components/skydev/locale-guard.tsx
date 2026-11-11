"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { localeOfPath, type SiteLocale } from "@/lib/site-locale";

/**
 * L'en-tête et le pied de page (le « layout ») ne sont pas recalculés lors d'une navigation sans rechargement.
 * Si la page affichée n'est plus dans la langue du cadre (FR ↔ EN), on recharge pour tout avoir dans la bonne langue.
 */
export function LocaleGuard({ locale }: { locale: SiteLocale }) {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = locale;
    if (localeOfPath(window.location.pathname) !== locale) window.location.reload();
  }, [pathname, locale]);
  return null;
}
