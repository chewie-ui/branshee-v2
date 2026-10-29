"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BellRing, Check, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Star, Trash2, UserRound, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/time";
import { policyAmounts } from "@/lib/cancellation";
import { policyLines } from "@/lib/cancellation-text";
import { createPublicBooking, getPublicSlots, joinWaitlist, startPayment, type PublicDay } from "@/server/actions/booking";
import { PaymentStep } from "@/components/booking/payment-step";
import { bookGroupSession, getPublicSessions } from "@/server/actions/group-sessions";
import type { PublicSession } from "@/server/group-sessions";
import type { PublicBusiness } from "@/server/public";
import { questionMatters, serviceMatches } from "@/lib/intake";
import { useI18n } from "@/i18n/client";
import { useEmbedded } from "@/lib/use-embedded";
import { intlLocale } from "@/i18n";
import type { Locale } from "@/i18n/config";

type Step = "visit" | "service" | "member" | "time" | "session" | "details";
export type BookingResume = { serviceId: string; memberId: string | null; day: string | null; time: string | null; visit: "new" | "existing" | null; intake: { questionId: string; optionId: string }[] };
type Props = { data: PublicBusiness; today: string; resume?: BookingResume | null; viewer?: { firstName: string; lastName: string; email: string; phone: string } | null };

/** Formats de date dans la langue de la page. */
function fmts(locale: Locale) {
  const l = intlLocale(locale);
  return {
    WEEKDAY: new Intl.DateTimeFormat(l, { weekday: "short", timeZone: "UTC" }),
    DAYNUM: new Intl.DateTimeFormat(l, { day: "numeric", timeZone: "UTC" }),
    LONG: new Intl.DateTimeFormat(l, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
    MONTH: new Intl.DateTimeFormat(l, { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}
const utc = (d: string) => new Date(d + "T12:00:00Z");
const addDays = (d: string, n: number) => {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Jour et heure d'une séance, dans le fuseau de l'établissement. */
const sessionParts = (iso: string, timeZone: string) => {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("fr-BE", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { day, time };
};

export function BookingFlow({ data, today, resume: resumeProp = null, viewer = null }: Props) {
  // Reprise après connexion : seulement si la prestation existe toujours.
  const resumeSvc = resumeProp ? data.services.find((s) => s.id === resumeProp.serviceId) : null;
  const resume = resumeSvc ? resumeProp : null;
  const resumeAt = resume && resumeSvc?.kind !== "group" && resume.day && resume.time && resume.day >= today;
  const router = useRouter();
  const { locale, t, tr } = useI18n();
  // Calendrier intégré sur le site du pro : la connexion s'ouvre dans un nouvel onglet (pas dans l'iframe).
  const embedded = useEmbedded();
  const { WEEKDAY, DAYNUM, LONG, MONTH } = useMemo(() => fmts(locale), [locale]);
  const money = (c: number) => new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "EUR" }).format(c / 100);
  const at = (day: string, time: string) => t("common.at", { day: cap(LONG.format(utc(day))), time });
  const { categories, team, questions, settings } = data;
  const fv = settings?.firstVisitQuestion;
  const [visit, setVisit] = useState<"new" | "existing" | null>(resume?.visit ?? null);
  const [step, setStep] = useState<Step>(resume ? (resumeSvc?.kind === "group" ? "session" : resumeAt ? "details" : "time") : fv?.enabled ? "visit" : "service");
  // Prestations proposées selon la réponse à « première visite ? ».
  const byAudience = useMemo(() => (visit ? data.services.filter((s) => s.audience === "all" || s.audience === visit) : data.services), [data.services, visit]);
  // Questionnaire d'orientation : réponses dans l'ordre où elles ont été données (pour pouvoir revenir en arrière).
  const [intakeOrder, setIntakeOrder] = useState<{ questionId: string; optionId: string }[]>(resume?.intake ?? []);
  const intakeAnswers = useMemo(() => Object.fromEntries(intakeOrder.map((a) => [a.questionId, a.optionId])), [intakeOrder]);
  const services = useMemo(() => {
    const answered = data.intake.filter((q) => intakeAnswers[q.id]);
    return byAudience.filter((s) => serviceMatches(s.id, answered, intakeAnswers));
  }, [byAudience, data.intake, intakeAnswers]);
  // Prochaine question utile : non répondue, et dont la réponse change encore les prestations proposées.
  const nextQuestion = data.intake.find((q) => !intakeAnswers[q.id] && questionMatters(q, services.map((s) => s.id))) ?? null;
  const [serviceId, setServiceId] = useState<string | null>(resume?.serviceId ?? null);
  const [memberId, setMemberId] = useState<string | null>(resume?.memberId ?? null);
  const [weekStart, setWeekStart] = useState(resumeAt ? resume!.day! : today);
  const [days, setDays] = useState<PublicDay[] | null>(null);
  const [day, setDay] = useState<string | null>(resumeAt ? resume!.day : null);
  const [time, setTime] = useState<string | null>(resumeAt ? resume!.time : null);
  const [loadingSlots, startSlots] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<PublicSession[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const tz = data.business.timezone;
  const style = data.categoryStyle;
  const waitlistOn = !!settings?.waitlistEnabled;
  const horizonDays = settings?.horizonDays ?? null;
  const [catFilter, setCatFilter] = useState("all");

  const service = services.find((s) => s.id === serviceId) ?? null;
  const member = team.find((m) => m.id === memberId) ?? null;
  const candidates = service ? team.filter((m) => service.memberIds.includes(m.id)) : [];
  // Plusieurs rendez-vous d'un coup : seulement sans paiement en ligne ni carte en garantie (un paiement = un rendez-vous).
  const multiOk = (svc: { kind: string; priceCents: number | null } | null) => !!svc && svc.kind !== "group" && !((svc.priceCents ?? 0) > 0 && (data.payment.required || data.payment.guarantee));
  const [cart, setCart] = useState<{ serviceId: string; memberId: string | null; day: string; time: string }[]>([]);
  const [multiDone, setMultiDone] = useState<{ label: string; token?: string; error?: string }[] | null>(null);

  // Semaine sans aucun créneau à l'ouverture : on avance tout seul jusqu'à la première semaine qui en a (8 semaines max).
  // Désactivé dès que le client navigue lui-même entre les semaines.
  const autoSkip = useRef(0);
  useEffect(() => {
    autoSkip.current = 8;
  }, [serviceId, memberId]);

  // Charge les créneaux de la semaine affichée dès que la prestation / le praticien / la semaine changent.
  useEffect(() => {
    if (step !== "time" || !serviceId) return;
    let cancelled = false;
    startSlots(async () => {
      const res = await getPublicSlots(data.business.slug, serviceId, memberId, weekStart, 7);
      if (cancelled) return;
      const next = addDays(weekStart, 7);
      const withinHorizon = horizonDays == null || next <= addDays(today, horizonDays);
      if (autoSkip.current > 0 && !res.some((d) => d.slots.length) && withinHorizon) {
        autoSkip.current -= 1;
        setWeekStart(next);
        return;
      }
      autoSkip.current = 0;
      setDays(res);
      setDay((current) => (current && res.some((d) => d.date === current && d.slots.length) ? current : (res.find((d) => d.slots.length)?.date ?? null)));
    });
    return () => {
      cancelled = true;
    };
  }, [step, serviceId, memberId, weekStart, data.business.slug, today, horizonDays]);

  // Cours collectif : charge les séances à venir.
  useEffect(() => {
    if (step !== "session" || !serviceId) return;
    let cancelled = false;
    startSlots(async () => {
      const res = await getPublicSessions(data.business.slug, serviceId);
      if (!cancelled) setSessions(res);
    });
    return () => {
      cancelled = true;
    };
  }, [step, serviceId, data.business.slug]);

  const sessionsByDay = useMemo(() => {
    const out: { day: string; items: (PublicSession & { time: string })[] }[] = [];
    for (const s of sessions ?? []) {
      const { day, time } = sessionParts(s.startsAt, tz);
      const last = out.at(-1);
      if (last?.day === day) last.items.push({ ...s, time });
      else out.push({ day, items: [{ ...s, time }] });
    }
    return out;
  }, [sessions, tz]);
  const chosenSession = sessions?.find((s) => s.id === sessionId) ?? null;

  const grouped = useMemo(() => {
    const byCat = categories.map((c) => ({ key: c.id, name: `${c.icon ? `${c.icon} ` : ""}${c.name}`, items: services.filter((s) => s.categoryId === c.id) }));
    const rest = services.filter((s) => !s.categoryId || !categories.some((c) => c.id === s.categoryId));
    return [...byCat, ...(rest.length ? [{ key: "rest", name: categories.length ? t("booking.otherServices") : "", items: rest }] : [])].filter((g) => g.items.length);
  }, [services, categories, t]);

  function pickService(id: string) {
    setServiceId(id);
    setTime(null);
    setDays(null);
    setWeekStart(today);
    setSessionId(null);
    setSessions(null);
    const s = services.find((x) => x.id === id)!;
    if (s.kind === "group") {
      setMemberId(null);
      setStep("session");
      return;
    }
    const options = team.filter((m) => s.memberIds.includes(m.id));
    if (options.length <= 1) {
      setMemberId(options[0]?.id ?? null);
      setStep("time");
    } else {
      setMemberId(null);
      setStep("member");
    }
  }

  // Créneaux qui chevauchent un rendez-vous déjà dans la sélection : retirés.
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const clashes = (d: string, t: string) => cart.some((c) => {
    if (c.day !== d) return false;
    const other = data.services.find((x) => x.id === c.serviceId)?.durationMin ?? 30;
    const mine = service?.durationMin ?? 30;
    return mins(t) < mins(c.time) + other && mins(c.time) < mins(t) + mine;
  });
  const slotsOfDay = (days?.find((d) => d.date === day)?.slots ?? []).filter((s) => !clashes(day!, s.time));
  const maxDaySlots = Math.max(0, ...(days ?? []).map((d) => d.slots.length));
  const periods = [
    { label: t("booking.morning"), items: slotsOfDay.filter((s) => s.time < "12:00") },
    { label: t("booking.afternoon"), items: slotsOfDay.filter((s) => s.time >= "12:00" && s.time < "17:00") },
    { label: t("booking.evening"), items: slotsOfDay.filter((s) => s.time >= "17:00") },
  ].filter((p) => p.items.length);

  const [pendingPay, setPendingPay] = useState<{ mode: "pay" | "guarantee"; clientSecret: string; payload: Parameters<typeof createPublicBooking>[0] } | null>(null);
  const ruleText = data.payment.rule === "half_24h" ? t("booking.ruleHalf") : data.payment.rule === "full_12h" ? t("booking.ruleFull") : null;
  // Frais d'annulation / d'absence qui pourront être prélevés : le client les accepte explicitement (case à cocher).
  const policy =
    service && service.kind !== "group"
      ? policyAmounts(data.payment.rule, service.priceCents ?? 0, service.cancellationFeeType ? { type: service.cancellationFeeType, value: service.cancellationFeeValue } : null)
      : null;

  function submit(formData: FormData) {
    if (!service) return;
    setError(null);
    setFieldErrors({});
    const answers: Record<string, string> = {};
    for (const q of questions) answers[q.id] = String(formData.get(`q_${q.id}`) ?? "");
    if (policy && formData.get("acceptPolicy") !== "on") {
      setFieldErrors({ acceptPolicy: tr("Acceptez les conditions d'annulation pour réserver.") });
      return;
    }
    const contact = {
      acceptPolicy: formData.get("acceptPolicy") === "on",
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      message: String(formData.get("message") ?? ""),
      answers,
      intake: intakeAnswers,
      website: String(formData.get("website") ?? ""),
    };
    if (service.kind === "group") {
      if (!sessionId) return;
      startSubmit(async () => {
        const res = await bookGroupSession({ slug: data.business.slug, sessionId, ...contact, locale });
        if (res.ok) {
          router.push(`/r/${res.token}?nouveau=1`);
          return;
        }
        setError(tr(res.error));
        setFieldErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, tr(v)])));
        if (res.full) {
          setSessionId(null);
          setSessions(null);
          setStep("session");
        }
      });
      return;
    }
    if (!day || !time) return;
    const payload = {
      slug: data.business.slug,
      serviceId: service.id,
      memberId,
      date: day,
      time,
      ...contact,
      locale,
      paymentMethod: (String(formData.get("paymentMethod") ?? "") || "none") as "online" | "on_site" | "bank_transfer" | "paypal" | "none",
    };
    if (cart.length) {
      // Les rendez-vous de la sélection, puis celui en cours : réservés un par un avec les mêmes coordonnées.
      const items = [...cart, { serviceId: service.id, memberId, day, time }];
      startSubmit(async () => {
        const out: { label: string; token?: string; error?: string }[] = [];
        for (const it of items) {
          const svc = data.services.find((x) => x.id === it.serviceId);
          const res = await createPublicBooking({ ...payload, serviceId: it.serviceId, memberId: it.memberId, date: it.day, time: it.time, paymentMethod: payload.paymentMethod === "online" ? "none" : payload.paymentMethod }).catch(() => ({ ok: false as const, error: "Réservation impossible." }));
          const label = `${svc?.name ?? ""} · ${at(it.day, it.time)}`;
          if (res.ok) out.push({ label, token: res.token });
          else {
            out.push({ label, error: tr(res.error) });
            // Coordonnées invalides : inutile d'essayer les suivants, le formulaire reste affiché.
            if ("fieldErrors" in res && res.fieldErrors && Object.keys(res.fieldErrors).length && !out.some((o) => o.token)) {
              setError(tr(res.error));
              setFieldErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, tr(v)])));
              return;
            }
          }
        }
        setCart([]);
        setMultiDone(out);
      });
      return;
    }
    const price = service.priceCents ?? 0;
    const mode = payload.paymentMethod === "online" ? "pay" : data.payment.guarantee && price > 0 ? "guarantee" : null;
    if (mode) {
      startSubmit(async () => {
        const r = await startPayment({ slug: data.business.slug, serviceId: service.id, email: contact.email, name: `${contact.firstName} ${contact.lastName}`, mode });
        if (r.ok) setPendingPay({ mode, clientSecret: r.clientSecret, payload });
        else setError(tr(r.error));
      });
      return;
    }
    book(payload);
  }

  function book(payload: Parameters<typeof createPublicBooking>[0]) {
    startSubmit(async () => {
      const res = await createPublicBooking(payload);
      if (res.ok) {
        router.push(`/r/${res.token}?nouveau=1`);
        return;
      }
      setPendingPay(null);
      setError(tr(res.error));
      setFieldErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, tr(v)])));
      if (res.slotTaken) {
        setTime(null);
        setStep("time");
      }
    });
  }

  /** Adresse de retour après connexion : la page de réservation, avec les choix déjà faits. */
  function resumePath() {
    const p = new URLSearchParams({ reserver: "1" });
    if (serviceId) p.set("s", serviceId);
    if (memberId) p.set("m", memberId);
    if (day && time) {
      p.set("d", day);
      p.set("h", time);
    }
    if (visit) p.set("v", visit);
    for (const a of intakeOrder) p.append("q", `${a.questionId}.${a.optionId}`);
    return `/${data.business.slug}?${p.toString()}`;
  }

  const summary = (
    <div className="space-y-2 rounded-lg bg-surface-muted p-4 text-sm">
      {service ? (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{service.name}</p>
            <p className="text-muted">{formatDuration(service.durationMin, service.durationMaxMin)}</p>
          </div>
          <span className="font-semibold tabular-nums">{formatPrice(service.priceCents)}</span>
        </div>
      ) : null}
      {candidates.length > 1 ? (
        <p className="flex items-center gap-2 text-muted">
          <UserRound className="size-4" aria-hidden="true" />
          {member ? t("common.with", { name: member.name }) : t("booking.noPreferenceSummary")}
        </p>
      ) : null}
      {chosenSession ? (
        <p className="flex items-center gap-2 text-muted">
          <Clock className="size-4" aria-hidden="true" />
          {at(sessionParts(chosenSession.startsAt, tz).day, sessionParts(chosenSession.startsAt, tz).time)}
        </p>
      ) : null}
      {day && time ? (
        <p className="flex items-center gap-2 text-muted">
          <Clock className="size-4" aria-hidden="true" />
          {at(day, time)}
        </p>
      ) : null}
    </div>
  );

  if (data.services.length === 0) {
    return <p className="p-6 text-sm text-muted">{t("booking.noServices")}</p>;
  }

  if (multiDone) {
    const ok = multiDone.filter((d) => d.token);
    const ko = multiDone.filter((d) => !d.token);
    return (
      <div className="space-y-4" role="status">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success"><Check className="size-5" aria-hidden="true" /></span>
          <h2 className="text-lg font-semibold">{t("booking.multiDone", { n: ok.length })}</h2>
        </div>
        {ok.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {ok.map((d) => (
              <li key={d.token} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">{d.label}</span>
                <a href={`/r/${d.token}`} className="shrink-0 font-medium text-accent hover:text-accent-hover">{t("booking.seeAppt")}</a>
              </li>
            ))}
          </ul>
        ) : null}
        {ko.length ? (
          <div className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger" role="alert">
            <p className="font-medium">{t("booking.multiPartial")}</p>
            <ul className="mt-1 list-disc pl-5">{ko.map((d) => <li key={d.label}>{d.label} : {d.error}</li>)}</ul>
          </div>
        ) : null}
        {ok.length ? <p className="text-sm text-muted">{t("booking.emailEach")}</p> : null}
      </div>
    );
  }

  return (
    <div>
      {(step !== "service" && step !== "visit") || (step === "service" && (fv?.enabled || intakeOrder.length > 0)) ? (
        <button
          type="button"
          onClick={() => {
            if (step === "service" && intakeOrder.length > 0) return setIntakeOrder((o) => o.slice(0, -1));
            setStep(step === "details" ? (service?.kind === "group" ? "session" : "time") : step === "time" && candidates.length > 1 ? "member" : step === "service" ? "visit" : "service");
          }}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("common.back")}
        </button>
      ) : null}

      {cart.length && step !== "details" ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-soft-foreground" role="status"><Check className="size-4" aria-hidden="true" />{t("booking.cartTitle")} : {cart.length}</p>
      ) : null}
      {step === "visit" && fv ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{fv.question}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([["new", fv.newLabel], ["existing", fv.existingLabel]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => { setVisit(value); setStep("service"); }} className="rounded-xl border border-border bg-surface p-4 text-left font-medium transition-colors hover:border-accent">
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === "service" && nextQuestion ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{nextQuestion.question}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {nextQuestion.options.map((o) => (
              <button key={o.id} type="button" onClick={() => setIntakeOrder((list) => [...list, { questionId: nextQuestion.id, optionId: o.id }])} className="rounded-xl border border-border bg-surface p-4 text-left font-medium transition-colors hover:border-accent">
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === "service" && !nextQuestion && services.length === 0 ? (
        <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted">{t("booking.noMatch")}</p>
      ) : null}

      {step === "service" && !nextQuestion && services.length > 0 ? (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">{t("booking.chooseService")}</h2>
          {/* Pastilles : un filtre par catégorie au-dessus de la liste. */}
          {style === "pills" && grouped.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("booking.categories")}>
              {[{ key: "all", name: t("booking.all") }, ...grouped].map((g) => (
                <button key={g.key} type="button" aria-pressed={catFilter === g.key} onClick={() => setCatFilter(g.key)} className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", catFilter === g.key ? "border-accent bg-accent text-accent-foreground" : "border-border-strong bg-surface text-muted hover:text-text")}>
                  {g.name}
                </button>
              ))}
            </div>
          ) : null}
          {(style === "pills" ? grouped.filter((g) => catFilter === "all" || g.key === catFilter) : grouped).map((g) => {
            const list = (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => pickService(s.id)} className="flex w-full items-center gap-4 bg-surface px-4 py-4 text-left transition-colors hover:bg-surface-muted">
                      {s.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{s.name}</p>
                        {s.description ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{s.description}</p> : null}
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
                          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" />{formatDuration(s.durationMin, s.durationMaxMin)}</span>
                          {s.kind === "group" ? (
                            <span className="inline-flex items-center gap-1 font-medium text-accent">
                              <Users className="size-3.5" aria-hidden="true" />
                              {t("booking.groupClass")}
                            </span>
                          ) : null}
                          {s.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{s.location}</span> : null}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{formatPrice(s.priceCents)}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            );
            // Accordéon : chaque catégorie se déplie (la première est ouverte).
            if (style === "accordion" && g.name)
              return (
                <details key={g.key} open={g.key === grouped[0]?.key} className="group rounded-xl border border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
                    {g.name}
                    <span className="flex items-center gap-2 text-sm font-normal text-muted">{g.items.length}<ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" /></span>
                  </summary>
                  <div className="border-t border-border p-2">{list}</div>
                </details>
              );
            return (
              <section key={g.key}>
                {g.name && !(style === "pills" && grouped.length > 1) ? <h3 className="mb-2 text-sm font-semibold text-muted">{g.name}</h3> : null}
                {list}
              </section>
            );
          })}
        </div>
      ) : null}

      {step === "member" && service ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{t("booking.withWhom")}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <li>
              <button type="button" onClick={() => { setMemberId(null); setStep("time"); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent">
                <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted" aria-hidden="true">
                  <UserRound className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">{t("booking.noPreference")}</span>
                  <span className="block text-sm text-muted">{t("booking.firstAvailable")}</span>
                </span>
              </button>
            </li>
            {candidates.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => { setMemberId(m.id); setStep("time"); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent">
                  <Avatar name={m.name} src={m.photoUrl} size="lg" />
                  <span className="min-w-0">
                    <span className="block font-medium">{m.name}</span>
                    {m.role ? <span className="block truncate text-sm text-muted">{m.role}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {step === "time" && service ? (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold" data-theme-text="slotHeading">{data.theme.texts.slotHeading || t("booking.chooseSlot")}</h2>
          {summary}
          <p className="text-sm text-muted" data-theme-text="calendarHelp" hidden={!data.theme.texts.calendarHelp}>{data.theme.texts.calendarHelp}</p>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">{cap(MONTH.format(utc(weekStart)))}</p>
              <div className="flex gap-1">
                <button type="button" disabled={weekStart <= today || loadingSlots} onClick={() => { autoSkip.current = 0; setWeekStart(addDays(weekStart, -7) < today ? today : addDays(weekStart, -7)); }} className="flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40" aria-label={t("common.previousWeek")}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button type="button" disabled={loadingSlots || (settings?.horizonDays != null && addDays(weekStart, 7) > addDays(today, settings.horizonDays))} onClick={() => { autoSkip.current = 0; setWeekStart(addDays(weekStart, 7)); }} className="flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40" aria-label={t("common.nextWeek")}>
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={t("common.chooseDay")}>
              {(days ?? Array.from({ length: 7 }, (_, i) => ({ date: addDays(weekStart, i), slots: [] }))).map((d) => {
                const available = d.slots.length > 0;
                const selected = d.date === day;
                // Pastille : vert = places libres, orange = moins de la moitié des créneaux du jour le plus libre, rouge = complet.
                const busy = available && d.slots.length < maxDaySlots / 2;
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={(!available && !waitlistOn) || loadingSlots}
                    onClick={() => { setDay(d.date); setTime(null); }}
                    aria-pressed={selected}
                    aria-label={`${LONG.format(utc(d.date))}, ${available ? t("booking.slotsCount", { n: d.slots.length }) : t("booking.full")}`}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center rounded-lg border text-sm transition-colors disabled:cursor-not-allowed",
                      selected ? "border-transparent bg-[var(--day-selected-bg,var(--accent))] text-[var(--day-selected-text,var(--accent-foreground))]" : available ? "border-border-strong bg-[var(--day-bg,var(--surface))] text-[var(--day-text,var(--text))] hover:border-accent hover:bg-[var(--day-hover-bg,var(--surface))] hover:text-[var(--day-hover-text,var(--text))]" : "border-transparent bg-surface-muted text-muted",
                      loadingSlots && "animate-pulse",
                    )}
                  >
                    <span className="text-xs capitalize">{WEEKDAY.format(utc(d.date)).replace(".", "")}</span>
                    <span className="text-base font-semibold">{DAYNUM.format(utc(d.date))}</span>
                    {days ? <span className="mt-1 size-1.5 rounded-full" style={{ background: !available ? "var(--day-full, #ef4444)" : busy ? "var(--day-busy, #ea580c)" : "var(--day-available, #16a34a)" }} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div aria-live="polite">
            {loadingSlots ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <span key={i} className="h-10 animate-pulse rounded-lg bg-surface-muted" />)}</div>
            ) : days && !day ? (
              <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted">{waitlistOn ? t("booking.noSlotsWeekWaitlist") : t("booking.noSlotsWeek")}</p>
            ) : day && slotsOfDay.length === 0 && waitlistOn && service ? (
              <WaitlistForm slug={data.business.slug} serviceId={service.id} memberId={memberId} day={day} dayLabel={cap(LONG.format(utc(day)))} />
            ) : (
              <div className="space-y-4">
                {slotsOfDay.some((x) => x.grouped) ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted"><Star className="size-4 fill-current text-warning" aria-hidden="true" />{t("booking.recommended")}</p>
                ) : null}
                {periods.map((p) => (
                  <div key={p.label}>
                    <p className="mb-2 text-sm font-medium text-muted">{p.label}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {p.items.map((s) => (
                        <button
                          key={s.time}
                          type="button"
                          onClick={() => { setTime(s.time); setError(null); setStep("details"); }}
                          className={cn("relative h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors", time === s.time ? "border-accent bg-accent text-accent-foreground" : s.grouped ? "border-warning/60 bg-warning-soft text-text hover:border-accent" : "border-border-strong bg-surface hover:border-accent hover:text-accent")}
                          aria-label={s.grouped ? t("booking.recommendedSlot", { time: s.time }) : undefined}
                        >
                          {s.time}
                          {s.grouped ? <Star className="absolute top-1 right-1 size-2.5 fill-current text-warning" aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted" data-theme-text="timezone" hidden={!data.theme.texts.timezone}>{data.theme.texts.timezone}</p>
          {error ? <p className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {step === "session" && service ? (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">{t("booking.chooseSession")}</h2>
          {summary}
          <div aria-live="polite">
            {loadingSlots || !sessions ? (
              <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <span key={i} className="block h-14 animate-pulse rounded-lg bg-surface-muted" />)}</div>
            ) : sessions.length === 0 ? (
              <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted">{t("booking.noSessions")}</p>
            ) : (
              <div className="space-y-5">
                {sessionsByDay.map((g) => (
                  <section key={g.day}>
                    <h3 className="mb-2 text-sm font-semibold text-muted">{cap(LONG.format(utc(g.day)))}</h3>
                    <ul className="space-y-2">
                      {g.items.map((s) => {
                        const full = s.remaining === 0;
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              disabled={full}
                              onClick={() => { setSessionId(s.id); setError(null); setStep("details"); }}
                              className="flex w-full items-center gap-4 rounded-xl border border-border-strong bg-surface px-4 py-3 text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted"
                            >
                              <span className="text-base font-semibold tabular-nums">{s.time}</span>
                              <span className="min-w-0 flex-1 truncate text-sm text-muted">{s.memberName ? t("common.with", { name: s.memberName }) : ""}</span>
                              <span className={cn("shrink-0 text-sm font-medium", full ? "text-muted" : s.remaining != null && s.remaining <= 3 ? "text-warning" : "text-success")}>
                                {full ? t("booking.sessionFull") : s.remaining == null ? t("booking.placesFree") : t("booking.places", { n: s.remaining })}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
          {error ? <p className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {step === "details" && service && pendingPay ? (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">{pendingPay.mode === "pay" ? t("booking.payment") : t("booking.guaranteeCard")}</h2>
          {summary}
          <PaymentStep
            clientSecret={pendingPay.clientSecret}
            mode={pendingPay.mode}
            amountLabel={formatPrice(service.priceCents)}
            ruleText={ruleText}
            onBack={() => setPendingPay(null)}
            onDone={(intentId) => book({ ...pendingPay.payload, ...(pendingPay.mode === "pay" ? { paymentIntentId: intentId } : { setupIntentId: intentId }) })}
          />
          {submitting ? <p className="text-center text-sm text-muted">{t("booking.saving")}</p> : null}
        </div>
      ) : null}

      {step === "details" && service && !pendingPay && ((day && time) || chosenSession) ? (
        <form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }} className="space-y-5" noValidate>
          <h2 className="text-lg font-semibold">{cart.length ? t("booking.cartTitle") : t("booking.yourDetails")}</h2>
          {cart.map((c, i) => {
            const svc = data.services.find((x) => x.id === c.serviceId);
            const who = team.find((m) => m.id === c.memberId);
            return (
              <div key={`${c.serviceId}-${c.day}-${c.time}`} className="flex items-start justify-between gap-3 rounded-lg bg-surface-muted p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">{svc?.name}</p>
                  <p className="flex items-center gap-2 text-muted"><Clock className="size-4" aria-hidden="true" />{at(c.day, c.time)}</p>
                  {who ? <p className="flex items-center gap-2 text-muted"><UserRound className="size-4" aria-hidden="true" />{t("common.with", { name: who.name })}</p> : null}
                </div>
                <button type="button" onClick={() => setCart((l) => l.filter((_, j) => j !== i))} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-danger" aria-label={t("booking.removeItem")}><Trash2 className="size-4" aria-hidden="true" /></button>
              </div>
            );
          })}
          {summary}
          {multiOk(service) && day && time && cart.length < 5 && cart.every((c) => multiOk(data.services.find((x) => x.id === c.serviceId) ?? null)) ? (
            <button
              type="button"
              onClick={() => {
                if (clashes(day, time)) return setError(t("booking.alreadyInCart"));
                setCart((l) => [...l, { serviceId: service.id, memberId, day, time }]);
                setTime(null);
                setDay(null);
                setError(null);
                setStep("service");
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <Plus className="size-4" aria-hidden="true" />{t("booking.addAnother")}
            </button>
          ) : null}
          {error ? <p className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p> : null}
          {viewer ? (
            <p className="text-sm text-muted">{t("booking.loggedAs", { email: viewer.email })}</p>
          ) : (
            <p className="text-sm text-muted">
              {t("booking.haveAccount", { link: "\u0000" }).split("\u0000")[0]}
              <a href={`/connexion?suite=${encodeURIComponent(resumePath())}`} {...(embedded ? { target: "_blank", rel: "noopener" } : {})} className="font-medium text-accent hover:text-accent-hover">{t("booking.login")}</a>
              {t("booking.haveAccount", { link: "\u0000" }).split("\u0000")[1]}
            </p>
          )}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-px w-px opacity-0" aria-hidden="true" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("booking.firstName")} htmlFor="firstName" error={fieldErrors.firstName}>
              <Input id="firstName" name="firstName" autoComplete="given-name" defaultValue={viewer?.firstName} required aria-invalid={!!fieldErrors.firstName || undefined} />
            </Field>
            <Field label={t("booking.lastName")} htmlFor="lastName" error={fieldErrors.lastName}>
              <Input id="lastName" name="lastName" autoComplete="family-name" defaultValue={viewer?.lastName} required aria-invalid={!!fieldErrors.lastName || undefined} />
            </Field>
            <Field label={t("booking.email")} htmlFor="email" error={fieldErrors.email}>
              <Input id="email" name="email" type="email" autoComplete="email" defaultValue={viewer?.email} required aria-invalid={!!fieldErrors.email || undefined} />
            </Field>
            <Field label={settings?.phoneRequired ? t("booking.phone") : t("common.optional", { label: t("booking.phone") })} htmlFor="phone" error={fieldErrors.phone}>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={viewer?.phone} required={settings?.phoneRequired} aria-invalid={!!fieldErrors.phone || undefined} />
            </Field>
          </div>
          {questions.map((q) => {
            const key = `q_${q.id}`;
            const label = q.isRequired ? q.label : t("common.optional", { label: q.label });
            return (
              <Field key={q.id} label={label} htmlFor={key} error={fieldErrors[key]}>
                {q.type === "text" ? (
                  <Input id={key} name={key} required={q.isRequired} />
                ) : (
                  <Select id={key} name={key} defaultValue="" required={q.isRequired}>
                    <option value="">{t("common.choose")}</option>
                    {(q.type === "yes_no" ? ["Oui", "Non"] : q.options).map((o) => (
                      <option key={o} value={o}>{q.type === "yes_no" ? (o === "Oui" ? t("common.yes") : t("common.no")) : o}</option>
                    ))}
                  </Select>
                )}
              </Field>
            );
          })}
          <Field label={t("common.optional", { label: t("booking.message") })} htmlFor="message">
            <Textarea id="message" name="message" rows={3} maxLength={1000} placeholder={t("booking.messagePlaceholder")} />
          </Field>
          {service.kind !== "group" && ((service.priceCents ?? 0) > 0 || cart.length > 0) ? <PaymentChoice pay={data.payment} ruleText={policy ? null : ruleText} noOnline={cart.length > 0} /> : null}
          {policy ? (
            <fieldset className="space-y-3 rounded-lg border border-border-strong p-4 text-sm">
              <legend className="px-1 font-semibold">{t("booking.policyTitle")}</legend>
              <ul className="list-disc space-y-1 pl-5 text-muted">
                {policyLines(t, policy, money).map((l) => <li key={l}>{l}</li>)}
              </ul>
              <label className="flex items-start gap-3">
                <input type="checkbox" name="acceptPolicy" required className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]" aria-invalid={!!fieldErrors.acceptPolicy || undefined} aria-describedby={fieldErrors.acceptPolicy ? "acceptPolicy-error" : undefined} />
                <span>{t("booking.policyAccept")}</span>
              </label>
              {fieldErrors.acceptPolicy ? <p id="acceptPolicy-error" className="text-danger" role="alert">{fieldErrors.acceptPolicy}</p> : null}
            </fieldset>
          ) : null}
          <Button type="submit" loading={submitting} className="w-full" icon={<Check className="size-4" aria-hidden="true" />}>
            {service.kind === "group" ? t("booking.confirmGroup") : cart.length ? t("booking.confirmAll", { n: cart.length + 1 }) : settings?.autoConfirm ? t("booking.confirm") : t("booking.request")}
          </Button>
          {!settings?.autoConfirm && service.kind !== "group" ? <p className="text-center text-sm text-muted">{t("booking.willConfirm")}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

/** Jour complet : « Me prévenir si une place se libère ». */
function WaitlistForm({ slug, serviceId, memberId, day, dayLabel }: { slug: string; serviceId: string; memberId: string | null; day: string; dayLabel: string }) {
  const { locale, t, tr } = useI18n();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="rounded-lg bg-success-soft p-4 text-sm text-success" role="status">{t("booking.waitlistDone", { day: dayLabel.toLowerCase() })}</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await joinWaitlist({ slug, serviceId, memberId, date: day, name: String(fd.get("wl-name") ?? ""), email: String(fd.get("wl-email") ?? ""), website: String(fd.get("website") ?? ""), locale });
          if (r.ok) setDone(true);
          else setError(tr(r.error));
        });
      }}
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <p className="flex items-start gap-2 text-sm"><BellRing className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" /><span>{t("booking.waitlistIntro", { day: dayLabel })}</span></p>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-px w-px opacity-0" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input name="wl-name" placeholder={t("booking.waitlistName")} aria-label={t("booking.waitlistName")} required autoComplete="name" />
        <Input name="wl-email" type="email" placeholder={t("booking.waitlistEmail")} aria-label={t("booking.waitlistEmail")} required autoComplete="email" />
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <Button type="submit" size="sm" loading={pending}>{t("booking.waitlistSubmit")}</Button>
    </form>
  );
}

/** Choix du mode de paiement (affiché seulement s'il y a un vrai choix). */
function PaymentChoice({ pay, ruleText, noOnline = false }: { pay: PublicBusiness["payment"]; ruleText: string | null; noOnline?: boolean }) {
  const { t: tt } = useI18n();
  const site = [pay.onSite.cash && tt("booking.cash"), pay.onSite.card && tt("booking.card"), pay.onSite.qr && tt("booking.qr")].filter(Boolean).join(", ");
  const options = [
    pay.online && !noOnline ? { v: "online", t: tt("booking.payOnline"), d: tt("booking.payOnlineHint") } : null,
    !pay.required ? { v: "on_site", t: tt("booking.payOnSite"), d: site ? tt("booking.acceptedOnSite", { list: site }) : tt("booking.onTheDay") } : null,
    !pay.required && pay.onSite.bankTransfer ? { v: "bank_transfer", t: tt("booking.bankTransfer"), d: tt("booking.bankTransferHint") } : null,
    !pay.required && pay.onSite.paypal ? { v: "paypal", t: "PayPal", d: tt("booking.paypalHint") } : null,
  ].filter((o): o is { v: string; t: string; d: string } => !!o);
  const [value, setValue] = useState(options[0]?.v ?? "none");
  // Conditions affichées AVANT de réserver : paiement exigé, carte en garantie, frais d'annulation.
  const notes = (
    <div className="space-y-1 text-sm text-muted">
      {pay.required ? <p className="font-medium text-text">{tt("booking.payRequired")}</p> : null}
      {pay.guarantee && value !== "online" ? <p>{tt("booking.guaranteeNote")}</p> : null}
      {ruleText ? <p>{ruleText}</p> : null}
    </div>
  );
  if (options.length === 0) return ruleText ? notes : null;
  if (options.length === 1)
    return (
      <>
        <input type="hidden" name="paymentMethod" value={options[0]!.v} />
        {notes}
      </>
    );
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{tt("booking.payment")}</legend>
      {options.map((o) => (
        <label key={o.v} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm", value === o.v ? "border-accent bg-accent-soft" : "border-border-strong")}>
          <input type="radio" name="paymentMethod" value={o.v} checked={value === o.v} onChange={() => setValue(o.v)} className="mt-0.5 accent-[var(--accent)]" />
          <span>
            <span className="block font-medium">{o.t}</span>
            <span className="block text-muted">{o.d}</span>
          </span>
        </label>
      ))}
      {notes}
    </fieldset>
  );
}
