import "server-only";

/** Échappement HTML : tout ce qui vient d'un utilisateur passe par ici. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

type Detail = { label: string; value: string };
type Layout = {
  preheader: string;
  title: string;
  intro: string;
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

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(l.title)}</title></head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <span style="display:none;max-height:0;overflow:hidden">${esc(l.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:14px">
        <tr><td style="padding:32px 28px">
          <h1 style="margin:0 0 12px;font-size:22px;line-height:28px;color:#18181b">${esc(l.title)}</h1>
          <p style="margin:0;font-size:15px;line-height:23px;color:#3f3f46">${esc(l.intro)}</p>
          ${details}
          ${cta}
          ${l.note ? `<p style="margin:0;font-size:13px;line-height:20px;color:#52525b">${esc(l.note)}</p>` : ""}
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#71717a">${esc(l.footer)}</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [l.title, "", l.intro, "", ...(l.details ?? []).map((d) => `${d.label} : ${d.value}`), ...(l.cta ? ["", `${l.cta.label} : ${l.cta.url}`] : []), ...(l.note ? ["", l.note] : []), "", "—", l.footer].join("\n");
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
};

function apptDetails(a: AppointmentInfo): Detail[] {
  return [
    { label: "Prestation", value: a.serviceName },
    { label: "Date", value: a.when },
    ...(a.memberName ? [{ label: "Avec", value: a.memberName }] : []),
    ...(a.address ? [{ label: "Adresse", value: a.address }] : []),
  ];
}

/** Modes de paiement rappelés dans l'email de rappel (mêmes codes que l'ancien Branshee). */
export const PAYMENT_LABELS: Record<string, string> = { carte: "Carte bancaire", especes: "Espèces", qr_code: "QR code (Payconiq…)", virement: "Virement" };

const clientFooter = (a: AppointmentInfo) => `${a.businessName}${a.businessPhone ? ` · ${a.businessPhone}` : ""} — rendez-vous géré avec Branshee`;
const firstName = (n: string) => n.split(" ")[0] ?? n;

export const emails = {
  bookingConfirmed(a: AppointmentInfo, customMessage?: string | null) {
    return {
      subject: `Rendez-vous confirmé — ${a.businessName}`,
      ...render({
        preheader: `${a.serviceName}, ${a.when}`,
        title: "Votre rendez-vous est confirmé",
        intro: `Bonjour ${firstName(a.customerName)}, votre rendez-vous chez ${a.businessName} est bien enregistré.`,
        details: apptDetails(a),
        cta: { label: "Voir ou annuler le rendez-vous", url: a.manageUrl },
        note: customMessage || "Un empêchement ? Annulez depuis le lien ci-dessus pour libérer le créneau.",
        footer: clientFooter(a),
      }),
    };
  },

  bookingRequested(a: AppointmentInfo) {
    return {
      subject: `Demande de rendez-vous envoyée — ${a.businessName}`,
      ...render({
        preheader: `En attente de confirmation par ${a.businessName}`,
        title: "Demande bien reçue",
        intro: `Bonjour ${firstName(a.customerName)}, ${a.businessName} doit encore confirmer votre rendez-vous. Vous recevrez un email dès que c'est fait.`,
        details: apptDetails(a),
        cta: { label: "Suivre ma demande", url: a.manageUrl },
        footer: clientFooter(a),
      }),
    };
  },

  requestAccepted(a: AppointmentInfo, customMessage?: string | null) {
    return {
      subject: `Rendez-vous confirmé — ${a.businessName}`,
      ...render({
        preheader: `${a.businessName} a confirmé votre rendez-vous`,
        title: "Votre demande est acceptée",
        intro: `Bonne nouvelle ${firstName(a.customerName)} : ${a.businessName} a confirmé votre rendez-vous.`,
        details: apptDetails(a),
        cta: { label: "Voir le rendez-vous", url: a.manageUrl },
        note: customMessage ?? undefined,
        footer: clientFooter(a),
      }),
    };
  },

  requestRefused(a: AppointmentInfo, bookingUrl: string, reason?: string | null) {
    return {
      subject: `Rendez-vous non disponible — ${a.businessName}`,
      ...render({
        preheader: "Votre demande n'a pas pu être acceptée",
        title: "Demande non acceptée",
        intro: `Bonjour ${firstName(a.customerName)}, ${a.businessName} n'a malheureusement pas pu accepter votre demande pour ce créneau.`,
        details: apptDetails(a),
        cta: { label: "Choisir un autre créneau", url: bookingUrl },
        note: reason ? `Message de ${a.businessName} : « ${reason} »` : undefined,
        footer: clientFooter(a),
      }),
    };
  },

  cancelledForCustomer(a: AppointmentInfo, bookingUrl: string, customMessage?: string | null) {
    return {
      subject: `Rendez-vous annulé — ${a.businessName}`,
      ...render({
        preheader: `${a.serviceName}, ${a.when}`,
        title: "Rendez-vous annulé",
        intro: `Bonjour ${firstName(a.customerName)}, votre rendez-vous chez ${a.businessName} est annulé.`,
        details: apptDetails(a),
        cta: { label: "Reprendre rendez-vous", url: bookingUrl },
        note: customMessage ?? undefined,
        footer: clientFooter(a),
      }),
    };
  },

  rescheduled(a: AppointmentInfo, previousWhen: string, message?: string | null) {
    return {
      subject: `Rendez-vous déplacé — ${a.businessName}`,
      ...render({
        preheader: `Nouveau créneau : ${a.when}`,
        title: "Votre rendez-vous a été déplacé",
        intro: `Bonjour ${firstName(a.customerName)}, ${a.businessName} a déplacé votre rendez-vous initialement prévu ${previousWhen.charAt(0).toLowerCase() + previousWhen.slice(1)}.`,
        details: apptDetails(a),
        cta: { label: "Voir ou annuler le rendez-vous", url: a.manageUrl },
        note: message ? `Message de ${a.businessName} : « ${message} »` : "Ce nouveau créneau ne vous convient pas ? Annulez depuis le lien ci-dessus.",
        footer: clientFooter(a),
      }),
    };
  },

  waitlistSpot(p: { name: string; businessName: string; day: string; serviceName: string | null; bookingUrl: string; businessPhone: string | null }) {
    return {
      subject: `Une place s'est libérée — ${p.businessName}`,
      ...render({
        preheader: `${p.day} : une place est disponible`,
        title: "Une place s'est libérée",
        intro: `Bonjour ${firstName(p.name)}, vous aviez demandé à être prévenu(e) : une place vient de se libérer chez ${p.businessName} le ${p.day}${p.serviceName ? ` (${p.serviceName})` : ""}.`,
        cta: { label: "Réserver ce créneau", url: p.bookingUrl },
        note: "Premier arrivé, premier servi : la place peut être reprise par quelqu'un d'autre.",
        footer: `${p.businessName}${p.businessPhone ? ` · ${p.businessPhone}` : ""} — rendez-vous géré avec Branshee`,
      }),
    };
  },

  reminder(a: AppointmentInfo, customMessage?: string | null, payment?: { methods: string[]; note?: string | null }) {
    const methods = (payment?.methods ?? []).map((m) => PAYMENT_LABELS[m]).filter(Boolean);
    const pay = [methods.join(", "), payment?.note?.trim()].filter(Boolean).join(" — ");
    return {
      subject: `Rappel : rendez-vous ${a.when} — ${a.businessName}`,
      ...render({
        preheader: `${a.serviceName} chez ${a.businessName}`,
        title: "Rappel de votre rendez-vous",
        intro: `Bonjour ${firstName(a.customerName)}, petit rappel de votre rendez-vous chez ${a.businessName}.`,
        details: [...apptDetails(a), ...(pay ? [{ label: "Paiement sur place", value: pay }] : [])],
        cta: { label: "Voir ou annuler", url: a.manageUrl },
        note: customMessage || "Un empêchement ? Merci d'annuler dès que possible pour libérer le créneau.",
        footer: clientFooter(a),
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
};
