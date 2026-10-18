"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LANG_COOKIE, LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

/** Choix de la langue de la page (mémorisé un an). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  return (
    <label className={`inline-flex items-center gap-1.5 text-sm text-muted ${className ?? ""}`}>
      <Languages className="size-4" aria-hidden="true" />
      <span className="sr-only">{t("common.language")}</span>
      <select
        value={locale}
        onChange={(e) => {
          const l = e.target.value as Locale;
          document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${365 * 86400}; samesite=lax`;
          const url = new URL(window.location.href);
          url.searchParams.delete("lang");
          router.replace(url.pathname + url.search + url.hash);
          router.refresh();
        }}
        className="cursor-pointer rounded-md bg-transparent py-1 pr-1 text-sm hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
      >
        {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
      </select>
    </label>
  );
}
