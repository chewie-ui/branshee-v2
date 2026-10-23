import "server-only";
import { createT, getMessages, type T } from "@/i18n";
import type { Locale } from "@/i18n/config";

/** Échappement HTML : tout ce qui vient d'un utilisateur passe par ici. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Detail = { label: string; value: string };
type Layout = {
  lang?: string;
  preheader: string;
  title: string;
  intro: string;
  /** Message écrit par le pro, affiché en citation. */
  quote?: string;
  details?: Detail[];
  cta?: { label: string; url: string };
  note?: string;
  footer: string;
};

/** Gabarit commun : tableaux et styles en ligne pour un rendu correct dans tous les clients mail. */
function render(l: Layout): { html: string; text: string } {
  const details = l.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:10px;margin:24px 0">
        <tr><td style="padding:16px 20px">
          ${l.details.map((d) => `<p style="margin:0 0 8px;font-size:14px;line-height:20px;color:#52525b">${esc(d.label)}<br><strong style="color:#18181b;font-size:15px">${esc(d.value)}</strong></p>`).join("")}
        </td></tr>
      </table>`
    : "";
  const cta = l.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:8px;background:#4f46e5">
        <a href="${esc(l.cta.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(l.cta.label)}</a>
      </td></tr></table>`
    : "";

  const html = `<!doctype html><html lang="${l.lang ?? "fr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(l.title)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <span style="display:none;max-height:0;overflow:hidden">${esc(l.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:14px">
        <tr><td style="padding:32px 28px">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:28px;color:#18181b">${esc(l.title)}</h1>
          <p style="margin:0;font-size:15px;line-height:23px;color:#3f3f46">${esc(l.intro)}</p>
          ${l.quote ? `<p style="margin:16px 0 0;padding:12px 16px;border-left:3px solid #4f46e5;background:#f4f4f5;border-radius:6px;font-size:15px;line-height:23px;color:#18181b">${esc(l.quote).replace(/\n/g, "<br>")}</p>` : ""}
          ${details}
          ${cta}
          ${l.note ? `<p style="margin:0;font-size:13px;line-height:20px;color:#52525b">${esc(l.note)}</p>` : ""}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#71717a">${esc(l.footer)}</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [l.title, "", l.intro, "", ...(l.quote ? [l.quote, ""] : []), ...(l.details ?? []).map((d) => `${d.label} : ${d.value}`), ...(l.cta ? ["", `${l.cta.label} : ${l.cta.url}`] : []), ...(l.note ? ["", l.note] : []), "", "—", l.footer].join("\n");
  return { html, text };
}

export type AppointmentInfo = {
  businessName: string;
  serviceName: string;
  when: string;
  memberName: string | null;
  address: string | null;
  customerName: string;
  manageUrl: string;
  businessPhone: string | null;
  /** Forfait Pro+ : pas de mention Branshee dans les emails aux clients. */
  noBranding?: boolean;
  /** Langue du client (emails clients uniquement ; les emails au pro restent en français). */
  locale?: Locale | null;
};

function apptDetails(a: AppointmentInfo, t: T = tFor("fr")): Detail[] {
  return [
    { label: t("email.service"), value: a.serviceName },
    { label: t("email.date"), value: a.when },
    ...(a.memberName ? [{ label: t("email.with"), value: a.memberName }] : []),
    ...(a.address ? [{ label: t("email.address"), value: a.address }] : []),
  ];
}

/** Modes de paiement rappelés dans l'email de rappel (mêmes codes que l'ancien Branshee). */
export const PAYMENT_LABELS: Record<string, string> = { carte: "Carte bancaire", especes: "Espèces", qr_code: "QR code (Payconiq…)", virement: "Virement" };

const tFor = (locale?: Locale | null) => createT(getMessages(locale ?? "fr"));
const footerFor = (t: T, business: string, phone: string | null, noBranding?: boolean) => t(noBranding ? "email.footerNoBrand" : "email.footer", { business, phone: phone ? ` · ${phone}` : "" });
const clientFooter = (a: AppointmentInfo) => footerFor(tFor(a.locale), a.businessName, a.businessPhone, a.noBranding);
const firstName = (n: string) => n.split(" ")[0] ?? n;
/** Gabarit d'un email client, dans la langue choisie à la réservation. */
const customer = (a: AppointmentInfo) => {
  const t = tFor(a.locale);
  return { t, lang: a.locale ?? "fr", name: firstName(a.customerName), business: a.businessName, details: apptDetails(a, t), footer: clientFooter(a) };
};

export const emails = {
  bookingConfirmed(a: AppointmentInfo, customMessage?: string | null) {
    const c = customer(a);
    return {
      subject: c.t("email.confirmedSubject", { business: c.business }),
      ...render({
        lang: c.lang,
        preheader: `${a.serviceName}, ${a.when}`,
        title: c.t("email.confirmedTitle"),
        intro: c.t("email.confirmedIntro", { name: c.name, business: c.business }),
        details: c.details,
        cta: { label: c.t("email.seeOrCancel"), url: a.manageUrl },
        note: customMessage || c.t("email.confirmedNote"),
        footer: c.footer,
      }),
    };
  },

  bookingRequested(a: AppointmentInfo) {
    const c = customer(a);
    return {
      subject: c.t("email.requestedSubject", { business: c.business }),
      ...render({
        lang: c.lang,
        preheader: c.t("email.requestedPre", { business: c.business }),
        title: c.t("email.requestedTitle"),
        intro: c.t("email.requestedIntro", { name: c.name, business: c.business }),
        details: c.details,
        cta: { label: c.t("email.followRequest"), url: a.manageUrl },
        footer: c.footer,
      }),
    };
  },

  requestAccepted(a: AppointmentInfo, customMessage?: string | null) {
    const c = customer(a);
    return {
      subject: c.t("email.confirmedSubject", { business: c.business }),
      ...render({
        lang: c.lang,
        preheader: c.t("email.acceptedPre", { business: c.business }),
        title: c.t("email.acceptedTitle"),
        intro: c.t("email.acceptedIntro", { name: c.name, business: c.business }),
        details: c.details,
        cta: { label: c.t("email.seeAppointment"), url: a.manageUrl },
        note: customMessage ?? undefined,
        footer: c.footer,
      }),
    };
  },

  requestRefused(a: AppointmentInfo, bookingUrl: string, reason?: string | null) {
    const c = customer(a);
    return {
      subject: c.t("email.refusedSubject", { business: c.business }),
      ...render({
        lang: c.lang,
        preheader: c.t("email.refusedPre"),
        title: c.t("email.refusedTitle"),
        intro: c.t("email.refusedIntro", { name: c.name, business: c.business }),
        details: c.details,
        cta: { label: c.t("email.otherSlot"), url: bookingUrl },
        note: reason ? c.t("email.messageFrom", { business: c.business, message: reason }) : undefined,
        footer: c.footer,
      }),
    };
  },

  cancelledForCustomer(a: AppointmentInfo, bookingUrl: string, customMessage?: string | null, fee?: { kind: "charged" | "kept"; amount: string } | null) {
    const c = customer(a);
    const feeNote = fee ? c.t(fee.kind === "charged" ? "email.cancelFeeCharged" : "email.cancelFeeKept", { amount: fee.amount }) : null;
    return {
      subject: c.t("email.cancelledSubject", { business: c.business }),
      ...render({
        lang: c.lang,
        preheader: `${a.serviceName}, ${a.when}`,
        title: c.t("email.cancelledTitle"),
        intro: c.t("email.cancelledIntro", { name: c.name, business: c.business }),
        details: c.details,
        cta: { label: c.t("email.rebook"), url: bookingUrl },
        note: [feeNote, customMessage].filter(Boolean).join("\n\n") || undefined,
        footer: c.footer,
      }),
    };
  },

  rescheduled(a: AppointmentInfo, previousWhen: string, message?: string | null) {
    const c = customer(a);
    return {
      subject: c.t("email.rescheduledSubject", { business: c.business }),
      ...render({
        lang: c.lang,
        preheader: c.t("email.rescheduledPre", { when: a.when }),
        title: c.t("email.rescheduledTitle"),
        intro: c.t("email.rescheduledIntro", { name: c.name, business: c.business, previous: previousWhen }),
        details: c.details,
        cta: { label: c.t("email.seeOrCancel"), url: a.manageUrl },
        note: message ? c.t("email.messageFrom", { business: c.business, message }) : c.t("email.rescheduledNote"),
        footer: c.footer,
      }),
    };
  },

  customMessage(a: AppointmentInfo, message: string) {
    const c = customer(a);
    return {
      subject: c.t("email.customSubject", { business: c.business }),
      ...render({
        lang: c.lang,
        preheader: message.slice(0, 90),
        title: c.t("email.customTitle", { business: c.business }),
        intro: c.t("email.customIntro", { name: c.name, business: c.business }),
        quote: message,
        details: c.details,
        cta: { label: c.t("email.seeOrCancel"), url: a.manageUrl },
        footer: c.footer,
      }),
    };
  },

  waitlistSpot(p: { name: string; businessName: string; day: string; serviceName: string | null; bookingUrl: string; businessPhone: string | null; locale?: Locale | null }) {
    const t = tFor(p.locale);
    return {
      subject: t("email.waitlistSubject", { business: p.businessName }),
      ...render({
        lang: p.locale ?? "fr",
        preheader: t("email.waitlistPre", { day: p.day.charAt(0).toUpperCase() + p.day.slice(1) }),
        title: t("email.waitlistTitle"),
        intro: t("email.waitlistIntro", { name: firstName(p.name), business: p.businessName, day: p.day, service: p.serviceName ? ` (${p.serviceName})` : "" }),
        cta: { label: t("email.waitlistCta"), url: p.bookingUrl },
        note: t("email.waitlistNote"),
        footer: footerFor(t, p.businessName, p.businessPhone),
      }),
    };
  },

  reminder(a: AppointmentInfo, customMessage?: string | null, payment?: { methods: string[]; note?: string | null }) {
    const c = customer(a);
    const labels = getMessages(a.locale ?? "fr").email.payLabels as Record<string, string>;
    const methods = (payment?.methods ?? []).map((m) => labels[m]).filter(Boolean);
    const pay = [methods.join(", "), payment?.note?.trim()].filter(Boolean).join(" — ");
    return {
      subject: c.t("email.reminderSubject", { when: a.when, business: c.business }),
      ...render({
        lang: c.lang,
        preheader: c.t("email.reminderPre", { service: a.serviceName, business: c.business }),
        title: c.t("email.reminderTitle"),
        intro: c.t("email.reminderIntro", { name: c.name, business: c.business }),
        details: [...c.details, ...(pay ? [{ label: c.t("email.payOnSite"), value: pay }] : [])],
        cta: { label: c.t("email.seeOrCancelShort"), url: a.manageUrl },
        note: customMessage || c.t("email.reminderNote"),
        footer: c.footer,
      }),
    };
  },

  proNewBooking(a: AppointmentInfo & { pending: boolean; customerEmail: string | null; customerPhone: string | null }, appUrl: string) {
    return {
      subject: `${a.pending ? "Nouvelle demande" : "Nouveau rendez-vous"} : ${a.customerName}, ${a.when}`,
      ...render({
        preheader: `${a.serviceName} — réservé en ligne`,
        title: a.pending ? "Nouvelle demande à confirmer" : "Nouveau rendez-vous en ligne",
        intro: `${a.customerName} a ${a.pending ? "demandé" : "réservé"} un rendez-vous en ligne.`,
        details: [
          ...apptDetails(a).filter((d) => d.label !== "Adresse"),
          ...(a.customerPhone ? [{ label: "Téléphone", value: a.customerPhone }] : []),
          ...(a.customerEmail ? [{ label: "Email", value: a.customerEmail }] : []),
        ],
        cta: { label: a.pending ? "Confirmer ou refuser" : "Ouvrir l'agenda", url: appUrl },
        footer: `Branshee — ${a.businessName}`,
      }),
    };
  },

  proCancelled(a: AppointmentInfo, appUrl: string) {
    return {
      subject: `Annulation : ${a.customerName}, ${a.when}`,
      ...render({
        preheader: `${a.serviceName} — créneau libéré`,
        title: "Un client a annulé",
        intro: `${a.customerName} a annulé son rendez-vous. Le créneau est de nouveau disponible en ligne.`,
        details: apptDetails(a).filter((d) => d.label !== "Adresse"),
        cta: { label: "Ouvrir l'agenda", url: appUrl },
        footer: `Branshee — ${a.businessName}`,
      }),
    };
  },

  passwordResetCode(name: string, code: string) {
    return {
      subject: `${code} est votre code Branshee`,
      ...render({
        preheader: "Code de réinitialisation du mot de passe",
        title: "Réinitialiser votre mot de passe",
        intro: `Bonjour ${firstName(name)}, voici votre code pour choisir un nouveau mot de passe. Il est valable 15 minutes.`,
        details: [{ label: "Votre code", value: code }],
        note: "Vous n'êtes pas à l'origine de cette demande ? Ignorez cet email : votre mot de passe ne change pas.",
        footer: "Branshee",
      }),
    };
  },

  /** Code à 6 chiffres : vérification d'email, changement d'email, suppression de compte… */
  verificationCode(name: string, code: string, purpose: "email_verification" | "email_change" | "account_deletion") {
    const t = {
      email_verification: { title: "Confirmez votre adresse email", intro: "voici votre code pour confirmer votre adresse email.", note: "Vous n'avez pas créé de compte Branshee ? Ignorez cet email." },
      email_change: { title: "Confirmez votre nouvelle adresse", intro: "voici votre code pour confirmer votre nouvelle adresse email.", note: "Vous n'avez rien demandé ? Ignorez cet email : votre adresse ne change pas." },
      account_deletion: { title: "Suppression de votre compte", intro: "voici votre code pour confirmer la suppression définitive de votre compte.", note: "Vous n'avez rien demandé ? Ignorez cet email et changez votre mot de passe." },
    }[purpose];
    return {
      subject: `${code} est votre code Branshee`,
      ...render({
        preheader: t.title,
        title: t.title,
        intro: `Bonjour ${firstName(name)}, ${t.intro} Il est valable 15 minutes.`,
        details: [{ label: "Votre code", value: code }],
        note: t.note,
        footer: "Branshee",
      }),
    };
  },

  proRescheduledByCustomer(a: AppointmentInfo, previousWhen: string, appUrl: string) {
    return {
      subject: `RDV déplacé par le client : ${a.customerName}, ${a.when}`,
      ...render({
        preheader: `Avant : ${previousWhen}`,
        title: "Un client a déplacé son rendez-vous",
        intro: `${a.customerName} a déplacé son rendez-vous. Votre agenda est déjà à jour.`,
        details: [{ label: "Avant", value: previousWhen }, { label: "Après", value: a.when }, ...apptDetails(a).filter((d) => d.label !== "Adresse" && d.label !== "Date")],
        cta: { label: "Ouvrir l'agenda", url: appUrl },
        footer: `Branshee — ${a.businessName}`,
      }),
    };
  },

  teamInvitation(p: { businessName: string; inviterName: string; url: string; hasAccount: boolean }) {
    return {
      subject: `${p.inviterName} vous invite à rejoindre ${p.businessName} sur Branshee`,
      ...render({
        preheader: `Rejoignez l'équipe de ${p.businessName}`,
        title: `Rejoignez ${p.businessName}`,
        intro: `${p.inviterName} vous invite à rejoindre l'équipe de ${p.businessName} sur Branshee : agenda, clients et rendez-vous partagés.`,
        cta: { label: p.hasAccount ? "Voir l'invitation" : "Créer mon compte", url: p.url },
        note: "Vous ne connaissez pas cet établissement ? Ignorez simplement cet email.",
        footer: "Branshee",
      }),
    };
  },

  joinRequest(p: { businessName: string; requesterName: string; url: string }) {
    return {
      subject: `${p.requesterName} demande à rejoindre ${p.businessName}`,
      ...render({
        preheader: "Nouvelle demande pour rejoindre votre équipe",
        title: "Demande pour rejoindre votre équipe",
        intro: `${p.requesterName} souhaite rejoindre ${p.businessName} sur Branshee. Acceptez ou refusez depuis la page Équipe.`,
        cta: { label: "Voir la demande", url: p.url },
        footer: `Branshee — ${p.businessName}`,
      }),
    };
  },

  supportNewMessage(p: { from: string; email: string; body: string; url: string }) {
    return {
      subject: `Support : nouveau message de ${p.from}`,
      ...render({
        preheader: p.body.slice(0, 90),
        title: "Nouveau message au support",
        intro: `${p.from} (${p.email}) a écrit :`,
        details: [{ label: "Message", value: p.body.slice(0, 1500) }],
        cta: { label: "Répondre", url: p.url },
        footer: "Branshee — support",
      }),
    };
  },

  supportReply(p: { name: string; body: string; url: string }) {
    return {
      subject: "L'équipe Branshee vous a répondu",
      ...render({
        preheader: p.body.slice(0, 90),
        title: `Bonjour ${p.name},`,
        intro: "L'équipe Branshee a répondu à votre message :",
        details: [{ label: "Réponse", value: p.body.slice(0, 1500) }],
        cta: { label: "Voir la conversation", url: p.url },
        footer: "Branshee — support",
      }),
    };
  },

  welcomePro(p: { name: string; businessName: string; url: string }) {
    return {
      subject: "Bienvenue sur Branshee — configurez votre agenda",
      ...render({
        preheader: "Votre agenda en ligne est prêt à être configuré",
        title: `Bienvenue, ${p.name} !`,
        intro: `${p.businessName} est créé. En quelques minutes, vos clients pourront réserver en ligne 24 h/24 :`,
        details: [
          { label: "1. Vos horaires", value: "Les jours et heures où l'on peut réserver" },
          { label: "2. Vos prestations", value: "Ce que vos clients réservent, avec durée et prix" },
          { label: "3. Votre lien", value: "À partager sur Google, Instagram, WhatsApp…" },
        ],
        cta: { label: "Configurer mon agenda", url: p.url },
        note: "Une question ? Répondez simplement à cet email ou écrivez-nous depuis « Aide et support » : un humain vous répond.",
        footer: "Branshee",
      }),
    };
  },

  onboardingNudge(p: { name: string; steps: { title: string; desc: string }[]; stage: 1 | 2; url: string }) {
    const one = p.steps.length === 1;
    return {
      subject: one ? "Il ne reste qu'une étape pour lancer votre agenda Branshee" : "Votre agenda Branshee est presque prêt",
      ...render({
        preheader: "Encore un petit effort et vos clients pourront réserver en ligne",
        title: p.stage === 2 ? `${p.name}, on vous aide à finir ?` : `Encore un petit effort, ${p.name}`,
        intro: `Vous avez créé votre compte Branshee, bravo ! Il vous reste ${one ? "une étape" : `${p.steps.length} étapes`} pour que vos clients puissent réserver en ligne :`,
        details: p.steps.map((s) => ({ label: s.title, value: s.desc })),
        cta: { label: "Terminer la configuration", url: p.url },
        note: "Besoin d'un coup de main ? Une visite guidée vous montre où cliquer, depuis « Aide et support ».",
        footer: "Branshee",
      }),
    };
  },

  createBusinessNudge(p: { name: string; url: string }) {
    return {
      subject: "Créez votre page de réservation Branshee en 1 minute",
      ...render({
        preheader: "Votre compte est prêt, il ne manque que votre établissement",
        title: `Bonjour ${p.name},`,
        intro: "Votre compte Branshee est prêt, mais vous n'avez pas encore créé votre établissement. Une minute suffit : nom, métier, ville, et votre page de réservation est en ligne.",
        cta: { label: "Créer mon établissement", url: p.url },
        note: "Vous utilisez Branshee seulement pour réserver chez un professionnel ? Ignorez cet email, il n'y en aura pas d'autre.",
        footer: "Branshee",
      }),
    };
  },

  grantExpiry(p: { name: string; businessName: string; daysLeft: number; until: string; bookings30: number; url: string; trial?: boolean }) {
    const what = p.trial ? "Votre essai gratuit Branshee" : "Votre accès complet Branshee";
    return {
      subject: p.daysLeft <= 1 ? `${what} se termine demain` : `${what} se termine dans ${p.daysLeft} jours`,
      ...render({
        preheader: p.trial ? `Fin de l'essai le ${p.until}` : `Fin de l'accès offert le ${p.until}`,
        title: `Bonjour ${p.name},`,
        intro: p.trial
          ? `L'essai gratuit du forfait Pro pour ${p.businessName} se termine le ${p.until}. Pour que vos clients puissent continuer à réserver en ligne, choisissez un forfait : sans engagement, résiliable en un clic. Sinon, votre page de réservation sera fermée (vos rendez-vous et votre fichier restent consultables, rien n'est supprimé).`
          : `L'accès complet offert à ${p.businessName} se termine le ${p.until}. Pour que vos clients puissent continuer à réserver en ligne, choisissez un forfait. Sinon, votre page de réservation sera fermée (rien n'est supprimé).`,
        details: [{ label: "Réservations ces 30 derniers jours", value: String(p.bookings30) }],
        cta: { label: "Choisir mon forfait", url: p.url },
        note: p.trial ? "En vous abonnant avant la fin de l'essai, vous ne payez qu'à partir de cette date." : undefined,
        footer: `Branshee — ${p.businessName}`,
      }),
    };
  },

  trialStarted(p: { name: string; businessName: string; until: string; url: string }) {
    return {
      subject: "Branshee fait peau neuve : 30 jours du forfait Pro offerts",
      ...render({
        preheader: `Tout le forfait Pro offert jusqu'au ${p.until}`,
        title: `Bonjour ${p.name},`,
        intro: `Branshee passe à une nouvelle version, plus rapide et plus complète. Pour la découvrir, ${p.businessName} profite du forfait Pro offert pendant 30 jours, jusqu'au ${p.until} : rappels automatiques par email et SMS, réservations illimitées, personnalisation de votre page. Votre page et vos rendez-vous sont repris tels quels.`,
        details: [
          { label: "Essai gratuit", value: `jusqu'au ${p.until}` },
          { label: "Ensuite", value: "Pro à 19 €/mois, sans engagement" },
        ],
        cta: { label: "Découvrir les forfaits", url: p.url },
        note: "Le forfait gratuit disparaît : à la fin de l'essai, la réservation en ligne reste ouverte seulement avec un abonnement. Nous vous préviendrons 7 jours et 1 jour avant.",
        footer: `Branshee — ${p.businessName}`,
      }),
    };
  },

  planEnded(p: { name: string; businessName: string; url: string; trial: boolean }) {
    return {
      subject: "Votre réservation en ligne Branshee est fermée",
      ...render({
        preheader: "Choisissez un forfait pour la rouvrir en un clic",
        title: `Bonjour ${p.name},`,
        intro: `${p.trial ? "L'essai gratuit" : "L'accès offert"} de ${p.businessName} est terminé : vos clients ne peuvent plus réserver en ligne pour le moment. Vos rendez-vous, votre fichier et vos réglages sont conservés. Choisissez un forfait et votre page rouvre immédiatement.`,
        cta: { label: "Rouvrir ma réservation en ligne", url: p.url },
        footer: `Branshee — ${p.businessName}`,
      }),
    };
  },

  autoConfirmLimit(p: { businessName: string; max: number; url: string }) {
    return {
      subject: "Limite mensuelle atteinte : les réservations passent en demande",
      ...render({
        preheader: "Vos prochaines réservations en ligne seront à confirmer",
        title: "Limite mensuelle atteinte",
        intro: `${p.businessName} a reçu ${p.max} réservations confirmées automatiquement ce mois-ci, le maximum du forfait gratuit. Vos clients peuvent toujours réserver : les prochaines demandes arrivent « à confirmer » dans votre espace jusqu'au début du mois prochain.`,
        cta: { label: "Passer au forfait Pro", url: p.url },
        note: "Avec le forfait Pro, toutes les réservations sont confirmées automatiquement et les rappels partent tout seuls.",
        footer: `Branshee — ${p.businessName}`,
      }),
    };
  },

  contactMessage(p: { name: string; email: string; subject: string; message: string }) {
    return {
      subject: `[Contact Branshee] ${p.subject}`,
      ...render({
        preheader: p.message.slice(0, 90),
        title: "Message depuis le formulaire de contact",
        intro: `${p.name} (${p.email}) a écrit :`,
        details: [{ label: "Sujet", value: p.subject }, { label: "Message", value: p.message }],
        note: "Répondez directement à cet email pour lui écrire.",
        footer: "Branshee — formulaire de contact",
      }),
    };
  },

  siteContact(p: { businessName: string; name: string; email: string; message: string }) {
    return {
      subject: `Message depuis votre site — ${p.businessName}`,
      ...render({
        preheader: p.message.slice(0, 90),
        title: "Nouveau message depuis votre site",
        intro: `${p.name} (${p.email}) vous a écrit depuis le formulaire de contact de votre site :`,
        details: [{ label: "Message", value: p.message }],
        note: "Répondez directement à cet email pour lui écrire.",
        footer: `Branshee — ${p.businessName}`,
      }),
    };
  },
};
