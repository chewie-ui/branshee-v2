"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BellRing, Check, ChevronLeft, ChevronRight, Clock, MapPin, Star, UserRound, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDuration, formatPrice } from "@/lib/time";
import { createPublicBooking, getPublicSlots, joinWaitlist, type PublicDay } from "@/server/actions/booking";
import { bookGroupSession, getPublicSessions } from "@/server/actions/group-sessions";
import type { PublicSession } from "@/server/group-sessions";
import type { PublicBusiness } from "@/server/public";
import { questionMatters, serviceMatches } from "@/lib/intake";

type Step = "visit" | "service" | "member" | "time" | "session" | "details";
type Props = { data: PublicBusiness; today: string; viewer?: { firstName: string; lastName: string; email: string; phone: string } | null };

const WEEKDAY = new Intl.DateTimeFormat("fr-BE", { weekday: "short", timeZone: "UTC" });
const DAYNUM = new Intl.DateTimeFormat("fr-BE", { day: "numeric", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("fr-BE", { month: "long", year: "numeric", timeZone: "UTC" });
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
  const time = new Intl.DateTimeFormat("fr-BE", { timeZone, hour: "2-digit", minute: "2-digit" }).format(d);
  return { day, time };
};

export function BookingFlow({ data, today, viewer = null }: Props) {
  const router = useRouter();
  const { categories, team, questions, settings } = data;
  const fv = settings?.firstVisitQuestion;
  const [visit, setVisit] = useState<"new" | "existing" | null>(null);
  const [step, setStep] = useState<Step>(fv?.enabled ? "visit" : "service");
  // Prestations proposées selon la réponse à « première visite ? ».
  const byAudience = useMemo(() => (visit ? data.services.filter((s) => s.audience === "all" || s.audience === visit) : data.services), [data.services, visit]);
  // Questionnaire d'orientation : réponses dans l'ordre où elles ont été données (pour pouvoir revenir en arrière).
  const [intakeOrder, setIntakeOrder] = useState<{ questionId: string; optionId: string }[]>([]);
  const intakeAnswers = useMemo(() => Object.fromEntries(intakeOrder.map((a) => [a.questionId, a.optionId])), [intakeOrder]);
  const services = useMemo(() => {
    const answered = data.intake.filter((q) => intakeAnswers[q.id]);
    return byAudience.filter((s) => serviceMatches(s.id, answered, intakeAnswers));
  }, [byAudience, data.intake, intakeAnswers]);
  // Prochaine question utile : non répondue, et dont la réponse change encore les prestations proposées.
  const nextQuestion = data.intake.find((q) => !intakeAnswers[q.id] && questionMatters(q, services.map((s) => s.id))) ?? null;
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(today);
  const [days, setDays] = useState<PublicDay[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [loadingSlots, startSlots] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<PublicSession[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const tz = data.business.timezone;
  const style = data.categoryStyle;
  const waitlistOn = !!settings?.waitlistEnabled;
  const [catFilter, setCatFilter] = useState("all");

  const service = services.find((s) => s.id === serviceId) ?? null;
  const member = team.find((m) => m.id === memberId) ?? null;
  const candidates = service ? team.filter((m) => service.memberIds.includes(m.id)) : [];

  // Charge les créneaux de la semaine affichée dès que la prestation / le praticien / la semaine changent.
  useEffect(() => {
    if (step !== "time" || !serviceId) return;
    let cancelled = false;
    startSlots(async () => {
      const res = await getPublicSlots(data.business.slug, serviceId, memberId, weekStart, 7);
      if (cancelled) return;
      setDays(res);
      setDay((current) => (current && res.some((d) => d.date === current && d.slots.length) ? current : (res.find((d) => d.slots.length)?.date ?? null)));
    });
    return () => {
      cancelled = true;
    };
  }, [step, serviceId, memberId, weekStart, data.business.slug]);

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
    return [...byCat, ...(rest.length ? [{ key: "rest", name: categories.length ? "Autres prestations" : "", items: rest }] : [])].filter((g) => g.items.length);
  }, [services, categories]);

  function pickService(id: string) {
    setServiceId(id);
    setTime(null);
    setDays(null);
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

  const slotsOfDay = days?.find((d) => d.date === day)?.slots ?? [];
  const maxDaySlots = Math.max(0, ...(days ?? []).map((d) => d.slots.length));
  const periods = [
    { label: "Matin", items: slotsOfDay.filter((s) => s.time < "12:00") },
    { label: "Après-midi", items: slotsOfDay.filter((s) => s.time >= "12:00" && s.time < "17:00") },
    { label: "Soir", items: slotsOfDay.filter((s) => s.time >= "17:00") },
  ].filter((p) => p.items.length);

  function submit(formData: FormData) {
    if (!service) return;
    setError(null);
    setFieldErrors({});
    const answers: Record<string, string> = {};
    for (const q of questions) answers[q.id] = String(formData.get(`q_${q.id}`) ?? "");
    const contact = {
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
        const res = await bookGroupSession({ slug: data.business.slug, sessionId, ...contact });
        if (res.ok) {
          router.push(`/r/${res.token}?nouveau=1`);
          return;
        }
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        if (res.full) {
          setSessionId(null);
          setSessions(null);
          setStep("session");
        }
      });
      return;
    }
    if (!day || !time) return;
    startSubmit(async () => {
      const res = await createPublicBooking({
        slug: data.business.slug,
        serviceId: service.id,
        memberId,
        date: day,
        time,
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        message: String(formData.get("message") ?? ""),
        answers,
        intake: intakeAnswers,
        website: String(formData.get("website") ?? ""),
      });
      if (res.ok) {
        router.push(`/r/${res.token}?nouveau=1`);
        return;
      }
      setError(res.error);
      setFieldErrors(res.fieldErrors ?? {});
      if (res.slotTaken) {
        setTime(null);
        setStep("time");
      }
    });
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
          {member ? `Avec ${member.name}` : "Sans préférence de praticien"}
        </p>
      ) : null}
      {chosenSession ? (
        <p className="flex items-center gap-2 text-muted">
          <Clock className="size-4" aria-hidden="true" />
          {cap(LONG.format(utc(sessionParts(chosenSession.startsAt, tz).day)))} à {sessionParts(chosenSession.startsAt, tz).time}
        </p>
      ) : null}
      {day && time ? (
        <p className="flex items-center gap-2 text-muted">
          <Clock className="size-4" aria-hidden="true" />
          {cap(LONG.format(utc(day)))} à {time}
        </p>
      ) : null}
    </div>
  );

  if (data.services.length === 0) {
    return <p className="p-6 text-sm text-muted">Aucune prestation n&apos;est réservable en ligne pour le moment.</p>;
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
          Retour
        </button>
      ) : null}

      {step === "visit" && fv ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{fv.question}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="grid gap-3 sm:grid-cols-2">
            {nextQuestion.options.map((o) => (
              <button key={o.id} type="button" onClick={() => setIntakeOrder((list) => [...list, { questionId: nextQuestion.id, optionId: o.id }])} className="rounded-xl border border-border bg-surface p-4 text-left font-medium transition-colors hover:border-accent">
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === "service" && !nextQuestion && services.length === 0 ? (
        <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted">Aucune prestation ne correspond à vos réponses pour la réservation en ligne. Contactez directement l&apos;établissement.</p>
      ) : null}

      {step === "service" && !nextQuestion && services.length > 0 ? (
        <div className="space-y-5">
          <h2 className="text-lg font-semibold">Choisissez une prestation</h2>
          {/* Pastilles : un filtre par catégorie au-dessus de la liste. */}
          {style === "pills" && grouped.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Catégories">
              {[{ key: "all", name: "Tout" }, ...grouped].map((g) => (
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
                              Cours collectif
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
          <h2 className="text-lg font-semibold">Avec qui ?</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            <li>
              <button type="button" onClick={() => { setMemberId(null); setStep("time"); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-accent">
                <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-muted" aria-hidden="true">
                  <UserRound className="size-5" />
                </span>
                <span>
                  <span className="block font-medium">Sans préférence</span>
                  <span className="block text-sm text-muted">Le premier disponible</span>
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
          <h2 className="text-lg font-semibold" data-theme-text="slotHeading">{data.theme.texts.slotHeading || "Choisissez un créneau"}</h2>
          {summary}
          <p className="text-sm text-muted" data-theme-text="calendarHelp" hidden={!data.theme.texts.calendarHelp}>{data.theme.texts.calendarHelp}</p>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">{cap(MONTH.format(utc(weekStart)))}</p>
              <div className="flex gap-1">
                <button type="button" disabled={weekStart <= today || loadingSlots} onClick={() => setWeekStart(addDays(weekStart, -7) < today ? today : addDays(weekStart, -7))} className="flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40" aria-label="Semaine précédente">
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button type="button" disabled={loadingSlots || (settings?.horizonDays != null && addDays(weekStart, 7) > addDays(today, settings.horizonDays))} onClick={() => setWeekStart(addDays(weekStart, 7))} className="flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40" aria-label="Semaine suivante">
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Choisir un jour">
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
                    aria-label={`${LONG.format(utc(d.date))}${available ? `, ${d.slots.length} créneaux` : ", complet"}`}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center rounded-lg border text-sm transition-colors disabled:cursor-not-allowed",
                      selected ? "border-transparent bg-[var(--day-selected-bg,var(--accent))] text-[var(--day-selected-text,var(--accent-foreground))]" : available ? "border-border-strong bg-[var(--day-bg,var(--surface))] hover:border-accent hover:bg-[var(--day-hover-bg,var(--surface))]" : "border-transparent bg-surface-muted text-muted",
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
              <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted">Aucun créneau libre cette semaine. Essayez la semaine suivante{waitlistOn ? ", ou choisissez un jour pour être prévenu si une place se libère" : ""}.</p>
            ) : day && slotsOfDay.length === 0 && waitlistOn && service ? (
              <WaitlistForm slug={data.business.slug} serviceId={service.id} memberId={memberId} day={day} dayLabel={cap(LONG.format(utc(day)))} />
            ) : (
              <div className="space-y-4">
                {slotsOfDay.some((x) => x.grouped) ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted"><Star className="size-4 fill-current text-warning" aria-hidden="true" />Créneaux conseillés</p>
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
                          className={cn("relative h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors", time === s.time ? "border-accent bg-accent text-accent-foreground" : s.grouped ? "border-warning/60 bg-warning-soft hover:border-accent hover:text-accent" : "border-border-strong bg-surface hover:border-accent hover:text-accent")}
                          aria-label={s.grouped ? `${s.time}, créneau conseillé` : undefined}
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
          <h2 className="text-lg font-semibold">Choisissez une séance</h2>
          {summary}
          <div aria-live="polite">
            {loadingSlots || !sessions ? (
              <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <span key={i} className="block h-14 animate-pulse rounded-lg bg-surface-muted" />)}</div>
            ) : sessions.length === 0 ? (
              <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted">Aucune séance planifiée pour le moment. Revenez bientôt ou contactez l&apos;établissement.</p>
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
                              <span className="min-w-0 flex-1 truncate text-sm text-muted">{s.memberName ? `Avec ${s.memberName}` : ""}</span>
                              <span className={cn("shrink-0 text-sm font-medium", full ? "text-muted" : s.remaining != null && s.remaining <= 3 ? "text-warning" : "text-success")}>
                                {full ? "Complet" : s.remaining == null ? "Places libres" : `${s.remaining} place${s.remaining > 1 ? "s" : ""}`}
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

      {step === "details" && service && ((day && time) || chosenSession) ? (
        <form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }} className="space-y-5" noValidate>
          <h2 className="text-lg font-semibold">Vos coordonnées</h2>
          {summary}
          {error ? <p className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger" role="alert">{error}</p> : null}
          {viewer ? (
            <p className="text-sm text-muted">Connecté en tant que <span className="font-medium text-text">{viewer.email}</span> : vos coordonnées sont pré-remplies.</p>
          ) : (
            <p className="text-sm text-muted">
              Déjà un compte ?{" "}
              <a href={`/connexion?suite=${encodeURIComponent(`/${data.business.slug}`)}`} className="font-medium text-accent hover:text-accent-hover">Connectez-vous</a> pour pré-remplir vos coordonnées et retrouver vos rendez-vous.
            </p>
          )}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-px w-px opacity-0" aria-hidden="true" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" htmlFor="firstName" error={fieldErrors.firstName}>
              <Input id="firstName" name="firstName" autoComplete="given-name" defaultValue={viewer?.firstName} required aria-invalid={!!fieldErrors.firstName || undefined} />
            </Field>
            <Field label="Nom" htmlFor="lastName" error={fieldErrors.lastName}>
              <Input id="lastName" name="lastName" autoComplete="family-name" defaultValue={viewer?.lastName} required aria-invalid={!!fieldErrors.lastName || undefined} />
            </Field>
            <Field label="Email" htmlFor="email" error={fieldErrors.email}>
              <Input id="email" name="email" type="email" autoComplete="email" defaultValue={viewer?.email} required aria-invalid={!!fieldErrors.email || undefined} />
            </Field>
            <Field label={settings?.phoneRequired ? "Téléphone" : "Téléphone (facultatif)"} htmlFor="phone" error={fieldErrors.phone}>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={viewer?.phone} required={settings?.phoneRequired} aria-invalid={!!fieldErrors.phone || undefined} />
            </Field>
          </div>
          {questions.map((q) => {
            const key = `q_${q.id}`;
            const label = q.isRequired ? q.label : `${q.label} (facultatif)`;
            return (
              <Field key={q.id} label={label} htmlFor={key} error={fieldErrors[key]}>
                {q.type === "text" ? (
                  <Input id={key} name={key} required={q.isRequired} />
                ) : (
                  <Select id={key} name={key} defaultValue="" required={q.isRequired}>
                    <option value="">Choisir…</option>
                    {(q.type === "yes_no" ? ["Oui", "Non"] : q.options).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </Select>
                )}
              </Field>
            );
          })}
          <Field label="Message (facultatif)" htmlFor="message">
            <Textarea id="message" name="message" rows={3} maxLength={1000} placeholder="Une précision pour le praticien ?" />
          </Field>
          <Button type="submit" loading={submitting} className="w-full" icon={<Check className="size-4" aria-hidden="true" />}>
            {service.kind === "group" ? "Confirmer l'inscription" : settings?.autoConfirm ? "Confirmer le rendez-vous" : "Envoyer la demande"}
          </Button>
          {!settings?.autoConfirm && service.kind !== "group" ? <p className="text-center text-sm text-muted">L&apos;établissement confirmera votre rendez-vous.</p> : null}
        </form>
      ) : null}
    </div>
  );
}

/** Jour complet : « Me prévenir si une place se libère ». */
function WaitlistForm({ slug, serviceId, memberId, day, dayLabel }: { slug: string; serviceId: string; memberId: string | null; day: string; dayLabel: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="rounded-lg bg-success-soft p-4 text-sm text-success" role="status">C&apos;est noté : vous recevrez un email si une place se libère le {dayLabel.toLowerCase()}.</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await joinWaitlist({ slug, serviceId, memberId, date: day, name: String(fd.get("wl-name") ?? ""), email: String(fd.get("wl-email") ?? ""), website: String(fd.get("website") ?? "") });
          if (r.ok) setDone(true);
          else setError(r.error);
        });
      }}
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <p className="flex items-start gap-2 text-sm"><BellRing className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" /><span>{dayLabel} est complet. Laissez votre email : nous vous prévenons si une place se libère.</span></p>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px] h-px w-px opacity-0" aria-hidden="true" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="wl-name" placeholder="Votre nom" aria-label="Votre nom" required autoComplete="name" />
        <Input name="wl-email" type="email" placeholder="Votre email" aria-label="Votre email" required autoComplete="email" />
      </div>
      {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
      <Button type="submit" size="sm" loading={pending}>Me prévenir</Button>
    </form>
  );
}
