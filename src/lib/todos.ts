/**
 * App Tâches : ajout rapide en langage naturel (français) et récurrences. Pur, testé.
 * Ex. « Appeler Marc demain 14h p1 #Chantier @Lucas » → titre, échéance, heure, priorité, liste, personne.
 */

export type Recurrence = "daily" | "weekdays" | "weekly" | "monthly" | "yearly";
export const RECURRENCE_LABEL: Record<Recurrence, string> = { daily: "Tous les jours", weekdays: "En semaine", weekly: "Chaque semaine", monthly: "Chaque mois", yearly: "Chaque année" };
export const PRIORITY_LABEL: Record<number, string> = { 1: "Urgent", 2: "Haute", 3: "Moyenne", 4: "Normale" };
export const LIST_COLORS = ["slate", "red", "orange", "amber", "green", "teal", "blue", "violet", "pink"] as const;

export type QuickAdd = { title: string; dueDate: string | null; dueTime: string | null; priority: number; listId: string | null; assigneeId: string | null; recurrence: Recurrence | null };

const DAY = 86400_000;
const toDate = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => iso(new Date(toDate(d).getTime() + n * DAY));
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];

/** Prochain jour de la semaine `wd` (0 = dimanche), strictement après `today`. */
function nextWeekday(today: string, wd: number) {
  const cur = toDate(today).getUTCDay();
  return addDays(today, ((wd - cur + 7) % 7) || 7);
}

function validDate(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? iso(dt) : null;
}

/** Date sans année : cette année, ou l'an prochain si elle est déjà passée. */
function upcoming(today: string, m: number, d: number) {
  const y = Number(today.slice(0, 4));
  const a = validDate(y, m, d);
  if (a && a >= today) return a;
  return validDate(y + 1, m, d);
}

export function parseQuickAdd(input: string, today: string, lists: { id: string; name: string }[] = [], people: { id: string; name: string }[] = []): QuickAdd {
  let s = ` ${input.replace(/\s+/g, " ").trim()} `;
  const out: QuickAdd = { title: "", dueDate: null, dueTime: null, priority: 4, listId: null, assigneeId: null, recurrence: null };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean | void) => {
    const m = s.match(re);
    if (m && fn(m) !== false) s = s.replace(m[0], " ");
  };

  // #liste et @personne (comparés sans accents ni majuscules, début du nom suffisant).
  take(/\s#([\p{L}\p{N}_-]{1,40})(?=\s)/u, (m) => {
    const k = norm(m[1]!).replace(/[_-]/g, " ");
    const l = lists.find((x) => norm(x.name) === k) ?? lists.find((x) => norm(x.name).startsWith(k));
    if (!l) return false;
    out.listId = l.id;
  });
  take(/\s@([\p{L}\p{N}_-]{1,40})(?=\s)/u, (m) => {
    const k = norm(m[1]!);
    const p = people.find((x) => norm(x.name).split(" ")[0] === k) ?? people.find((x) => norm(x.name).startsWith(k));
    if (!p) return false;
    out.assigneeId = p.id;
  });

  take(/\s(?:p([1-4])|(urgent))(?=\s)/i, (m) => { out.priority = m[2] ? 1 : Number(m[1]); });

  // Récurrences (avant les jours de la semaine : « tous les lundis » fixe aussi l'échéance).
  take(/\s(?:tous les|chaque) (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?(?=\s)/i, (m) => { out.recurrence = "weekly"; out.dueDate = nextWeekday(today, WEEKDAYS.indexOf(norm(m[1]!))); });
  take(/\s(?:tous les jours|chaque jour|quotidien(?:nement)?)(?=\s)/i, () => { out.recurrence = "daily"; out.dueDate ??= today; });
  take(/\s(?:en semaine|jours ouvrables|du lundi au vendredi)(?=\s)/i, () => { out.recurrence = "weekdays"; out.dueDate ??= today; });
  take(/\s(?:toutes les semaines|chaque semaine)(?=\s)/i, () => { out.recurrence = "weekly"; out.dueDate ??= today; });
  take(/\s(?:tous les mois|chaque mois)(?=\s)/i, () => { out.recurrence = "monthly"; out.dueDate ??= today; });
  take(/\s(?:tous les ans|chaque année|chaque annee)(?=\s)/i, () => { out.recurrence = "yearly"; out.dueDate ??= today; });

  // Heure : « à 14h », « 14h30 », « 14:30 ».
  take(/\s(?:à |a )?([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d))(?=\s)/i, (m) => { out.dueTime = `${m[1]!.padStart(2, "0")}:${m[2] ?? m[3] ?? "00"}`; });

  // Dates.
  take(/\s(aujourd'hui|aujourd’hui|auj|ce soir)(?=\s)/i, () => { out.dueDate = today; });
  take(/\s(après-demain|apres-demain|après demain|apres demain)(?=\s)/i, () => { out.dueDate = addDays(today, 2); });
  take(/\sdemain(?=\s)/i, () => { out.dueDate = addDays(today, 1); });
  take(/\sdans (\d{1,3}) (jours?|semaines?|mois)(?=\s)/i, (m) => {
    const n = Number(m[1]);
    if (/^mois/i.test(m[2]!)) { const d = toDate(today); d.setUTCMonth(d.getUTCMonth() + n); out.dueDate = iso(d); }
    else out.dueDate = addDays(today, /^sem/i.test(m[2]!) ? n * 7 : n);
  });
  take(/\s(?:la )?semaine prochaine(?=\s)/i, () => { out.dueDate = nextWeekday(today, 1); });
  take(/\s(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?: prochain)?(?=\s)/i, (m) => { out.dueDate = nextWeekday(today, WEEKDAYS.indexOf(norm(m[1]!))); });
  take(/\s(?:le )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, (m) => {
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    const d = y ? validDate(y, Number(m[2]), Number(m[1])) : upcoming(today, Number(m[2]), Number(m[1]));
    if (!d) return false;
    out.dueDate = d;
  });
  take(/\s(?:le )?(\d{1,2}) (janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?: (\d{4}))?(?=\s)/i, (m) => {
    const mo = MONTHS.indexOf(norm(m[2]!)) + 1;
    const d = m[3] ? validDate(Number(m[3]), mo, Number(m[1])) : upcoming(today, mo, Number(m[1]));
    if (!d) return false;
    out.dueDate = d;
  });
  take(/\sle (\d{1,2})(?=\s)/i, (m) => {
    const [y, mo] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
    const n = Number(m[1]);
    const d = validDate(y, mo, n);
    out.dueDate = d && d >= today ? d : (validDate(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, n) ?? out.dueDate);
    if (!out.dueDate) return false;
  });

  // Une heure sans date = aujourd'hui.
  if (out.dueTime && !out.dueDate) out.dueDate = today;
  out.title = s.replace(/\s+/g, " ").trim();
  if (!out.title) out.title = input.trim();
  return out;
}

/** Prochaine échéance d'une tâche récurrente (à partir de son échéance, jamais dans le passé). */
export function nextDue(due: string, r: Recurrence, today: string): string {
  const step = (d: string) => {
    if (r === "daily") return addDays(d, 1);
    if (r === "weekly") return addDays(d, 7);
    if (r === "weekdays") { let n = addDays(d, 1); while ([0, 6].includes(toDate(n).getUTCDay())) n = addDays(n, 1); return n; }
    const x = toDate(d);
    const day = x.getUTCDate();
    if (r === "monthly") x.setUTCMonth(x.getUTCMonth() + 1, 1);
    else x.setUTCFullYear(x.getUTCFullYear() + 1, x.getUTCMonth(), 1);
    // Le 31 → dernier jour du mois suivant s'il est plus court.
    const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
    x.setUTCDate(Math.min(day, last));
    return iso(x);
  };
  let n = step(due);
  for (let i = 0; n <= today && i < 40000; i++) n = step(n);
  return n <= today ? addDays(today, 1) : n;
}

/** Libellé court d'une échéance : « Aujourd'hui », « Demain », « Lundi », « 12 nov. », en retard. */
export function dueLabel(due: string, today: string) {
  const diff = Math.round((toDate(due).getTime() - toDate(today).getTime()) / DAY);
  if (diff === 0) return { text: "Aujourd'hui", late: false };
  if (diff === 1) return { text: "Demain", late: false };
  if (diff === -1) return { text: "Hier", late: true };
  if (diff > 1 && diff < 7) { const w = WEEKDAYS[toDate(due).getUTCDay()]!; return { text: w[0]!.toUpperCase() + w.slice(1), late: false }; }
  const text = new Intl.DateTimeFormat("fr-BE", { day: "numeric", month: "short", timeZone: "UTC", ...(due.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) }).format(toDate(due));
  return { text, late: diff < 0 };
}
