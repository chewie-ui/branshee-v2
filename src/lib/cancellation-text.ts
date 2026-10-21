import { createT, getMessages, intlLocale, type T } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { policyAmounts } from "@/lib/cancellation";

type Amounts = NonNullable<ReturnType<typeof policyAmounts>>;

export const euros = (cents: number, locale: Locale) => new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "EUR" }).format(cents / 100);

/** Lignes des conditions d'annulation, dans la langue du client (affichées et conservées telles quelles). */
export function policyLines(t: T, a: Amounts, money: (c: number) => string) {
  return [
    a.late12Cents != null
      ? t("booking.policyLateStrict", { half: money(a.late24Cents), full: money(a.late12Cents) })
      : t("booking.policyLate24", { amount: money(a.late24Cents) }),
    t("booking.policyNoShow", { amount: money(a.noShowCents) }),
    t("booking.policyOk"),
  ];
}

/** Texte exact accepté par le client (preuve conservée avec le rendez-vous). */
export function policyText(locale: Locale, a: Amounts) {
  const t = createT(getMessages(locale));
  return [...policyLines(t, a, (c) => euros(c, locale)), t("booking.policyAccept")].join("\n");
}
