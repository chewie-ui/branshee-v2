/**
 * Établissement de démonstration (données 100 % fictives).
 * Usage : DATABASE_URL=... npm run db:seed   — vide puis recrée la démo.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, startOfWeek } from "date-fns";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../src/db/schema";
import { BUILT_IN_GRADES } from "../src/lib/permissions";
import { hashPassword } from "../src/server/auth/password";

/** Mot de passe des comptes de démo — uniquement pour le développement local. */
export const DEMO_PASSWORD = "demo-branshee-2026";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant");
const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema: s, casing: "snake_case" });
const TZ = "Europe/Brussels";

// Générateur pseudo-aléatoire déterministe : la démo est identique à chaque lancement.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;

async function main() {
  const existing = await db.select().from(s.businesses).where(eq(s.businesses.slug, "cabinet-horizon"));
  if (existing[0]) {
    await db.delete(s.businesses).where(eq(s.businesses.id, existing[0].id));
    await db.delete(s.users).where(eq(s.users.email, "claire@cabinet-horizon.example"));
    await db.delete(s.users).where(eq(s.users.email, "thomas@cabinet-horizon.example"));
  }
  await db.delete(s.users).where(eq(s.users.email, "admin@branshee.example"));
  await db.insert(s.users).values({ email: "admin@branshee.example", fullName: "Admin Branshee", locale: "fr", isSuperadmin: true, passwordHash: await hashPassword(DEMO_PASSWORD) });

  const [owner] = await db.insert(s.users).values({ email: "claire@cabinet-horizon.example", fullName: "Claire Dumont", locale: "fr", passwordHash: await hashPassword(DEMO_PASSWORD) }).returning();
  const [colleague] = await db.insert(s.users).values({ email: "thomas@cabinet-horizon.example", fullName: "Thomas Lambert", locale: "fr", passwordHash: await hashPassword(DEMO_PASSWORD) }).returning();

  const [biz] = await db
    .insert(s.businesses)
    .values({
      ownerId: owner!.id,
      name: "Cabinet Horizon",
      slug: "cabinet-horizon",
      businessType: "Kinésithérapie",
      description: "Kinésithérapie générale et sportive, rééducation et Pilates en petit groupe.",
      email: "contact@cabinet-horizon.example",
      phone: "+32 10 00 00 00",
      address: "Rue de l'Exemple 1",
      postalCode: "1300",
      city: "Wavre",
      country: "BE",
      timezone: TZ,
    })
    .returning();
  const bid = biz!.id;

  await db.insert(s.bookingSettings).values({ businessId: bid, scheduleMode: "per_member", autoConfirm: false });
  await db.insert(s.paymentSettings).values({ businessId: bid });
  await db.insert(s.notificationSettings).values({ businessId: bid });
  await db.insert(s.bookingPageSettings).values({ businessId: bid });

  const gradeRows = await db.insert(s.grades).values(BUILT_IN_GRADES.map((g) => ({ businessId: bid, name: g.name, isBuiltIn: true, permissions: g.permissions }))).returning();
  const collabGrade = gradeRows.find((g) => g.name === "Collaborateur")!;

  const [mClaire, mThomas] = await db
    .insert(s.members)
    .values([
      { businessId: bid, userId: owner!.id, isOwner: true, status: "active", displayName: "Claire Dumont", roleLabel: "Kinésithérapeute", showRole: true, calendarColor: "#4f46e5", joinedAt: new Date() },
      { businessId: bid, userId: colleague!.id, status: "active", gradeId: collabGrade.id, displayName: "Thomas Lambert", roleLabel: "Kinésithérapeute du sport", showRole: true, calendarColor: "#0d9488", joinedAt: new Date() },
    ])
    .returning();

  const hours: { memberId: string; weekday: number; startTime: string; endTime: string }[] = [];
  for (const wd of [1, 2, 3, 4, 5]) {
    hours.push({ memberId: mClaire!.id, weekday: wd, startTime: "08:00", endTime: "12:00" }, { memberId: mClaire!.id, weekday: wd, startTime: "13:00", endTime: "18:00" });
    if (wd !== 3) hours.push({ memberId: mThomas!.id, weekday: wd, startTime: "10:00", endTime: "19:00" });
  }
  hours.push({ memberId: mThomas!.id, weekday: 6, startTime: "09:00", endTime: "13:00" });
  await db.insert(s.weeklyHours).values(hours.map((h) => ({ ...h, businessId: bid })));

  const [catKine, catSport, catGroup] = await db
    .insert(s.serviceCategories)
    .values([
      { businessId: bid, name: "Kinésithérapie", position: 0 },
      { businessId: bid, name: "Sport", position: 1 },
      { businessId: bid, name: "Cours collectifs", position: 2 },
    ])
    .returning();

  const svc = await db
    .insert(s.services)
    .values([
      { businessId: bid, categoryId: catKine!.id, name: "Bilan initial", description: "Premier rendez-vous : examen, diagnostic et plan de traitement.", durationMin: 45, priceCents: 4500, color: "#4f46e5", position: 0, audience: "new" },
      { businessId: bid, categoryId: catKine!.id, name: "Séance de kinésithérapie", description: "Séance de suivi.", durationMin: 30, priceCents: 3000, color: "#2563eb", position: 1 },
      { businessId: bid, categoryId: catKine!.id, name: "Drainage lymphatique", durationMin: 45, priceCents: 4000, color: "#7c3aed", position: 2 },
      { businessId: bid, categoryId: catSport!.id, name: "Rééducation sportive", description: "Reprise après blessure, renforcement ciblé.", durationMin: 45, priceCents: 4500, color: "#0d9488", position: 3 },
      { businessId: bid, categoryId: catSport!.id, name: "Bilan postural du coureur", durationMin: 60, priceCents: 6000, color: "#059669", position: 4 },
      { businessId: bid, categoryId: catGroup!.id, name: "Pilates en petit groupe", description: "Renforcement du centre, 6 personnes maximum.", durationMin: 60, priceCents: 1800, color: "#d97706", kind: "group", capacity: 6, position: 5, recurrence: { weekdays: [2, 4], startTime: "18:00" } },
      { businessId: bid, categoryId: catKine!.id, name: "Kiné prénatale", description: "Soulagement du dos et préparation à l'accouchement.", durationMin: 45, priceCents: 4000, color: "#db2777", position: 6 },
    ])
    .returning();

  // Questionnaire d'orientation : « Êtes-vous enceinte ? » → Oui : kiné prénatale ; Non : les autres soins.
  const [q] = await db.insert(s.intakeQuestions).values({ businessId: bid, question: "Êtes-vous enceinte ?", position: 0 }).returning();
  const [yes, no] = await db.insert(s.intakeOptions).values([{ questionId: q!.id, label: "Oui", position: 0 }, { questionId: q!.id, label: "Non", position: 1 }]).returning();
  await db.insert(s.serviceIntakeRules).values([
    { serviceId: svc[6]!.id, optionId: yes!.id },
    ...[1, 2, 3, 4].map((i) => ({ serviceId: svc[i]!.id, optionId: no!.id })),
  ]);
  // Drainage lymphatique : uniquement le mardi et le jeudi matin.
  await db.insert(s.serviceHours).values([2, 4].map((weekday) => ({ serviceId: svc[2]!.id, weekday, startTime: "08:00", endTime: "13:00" })));
  await db.insert(s.serviceMembers).values([
    { serviceId: svc[2]!.id, memberId: mClaire!.id },
    { serviceId: svc[3]!.id, memberId: mThomas!.id },
    { serviceId: svc[4]!.id, memberId: mThomas!.id },
    { serviceId: svc[5]!.id, memberId: mClaire!.id },
  ]);

  const names = ["Sophie Leroy", "Marc Dubois", "Emma Lambert", "Lucas Renard", "Chloé Martin", "Hugo Lefèvre", "Léa Simon", "Nathan Michel", "Camille Laurent", "Louis Girard", "Manon Fontaine", "Arthur Mercier", "Inès Bertrand", "Jules Moreau"];
  const custs = await db
    .insert(s.customers)
    .values(
      names.map((n, i) => {
        const [first, last] = n.split(" ") as [string, string];
        const slug = (first + "." + last).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        return { businessId: bid, firstName: first, lastName: last, fullName: n, email: `${slug}@exemple.be`, phone: `+32 470 ${String(100000 + i * 7919).slice(0, 2)} ${String(10 + i).padStart(2, "0")} ${String(30 + i)}`, createdAt: addDays(new Date(), -Math.floor(rand() * 120)) };
      }),
    )
    .returning();

  // Rendez-vous : 4 semaines passées + semaine en cours + semaine prochaine, sans chevauchement.
  const individual = svc.filter((x) => x.kind === "individual");
  const weekStart = startOfWeek(new TZDate(new Date(), TZ), { weekStartsOn: 1 });
  const rows: (typeof s.appointments.$inferInsert)[] = [];
  const now = new Date();
  for (let w = -4; w <= 1; w++) {
    for (let d = 0; d < 6; d++) {
      const day = addDays(weekStart, w * 7 + d);
      const wd = day.getDay();
      for (const m of [mClaire!, mThomas!]) {
        const ranges = hours.filter((h) => h.memberId === m.id && h.weekday === wd);
        for (const r of ranges) {
          let t = Number(r.startTime.slice(0, 2)) * 60;
          const end = Number(r.endTime.slice(0, 2)) * 60;
          while (t < end) {
            const service = m.id === mThomas!.id ? pick([individual[1]!, individual[3]!, individual[3]!, individual[4]!]) : pick([individual[0]!, individual[1]!, individual[1]!, individual[2]!]);
            if (t + service.durationMin > end) break;
            if (rand() < 0.55) {
              const startsAt = new Date(new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(t / 60), t % 60, 0, TZ).getTime());
              const c = pick(custs);
              const future = startsAt > now;
              const status = future && rand() < 0.08 ? "pending" : "confirmed";
              rows.push({
                businessId: bid,
                startsAt,
                endsAt: new Date(startsAt.getTime() + service.durationMin * 60000),
                memberId: m.id,
                serviceId: service.id,
                customerId: c.id,
                serviceName: service.name,
                serviceColor: service.color,
                contactName: c.fullName,
                contactEmail: c.email,
                contactPhone: c.phone,
                status: !future && rand() < 0.05 ? "cancelled" : status,
                noShow: !future && rand() < 0.03,
              });
            }
            t += service.durationMin + (rand() < 0.4 ? 15 : 0);
          }
        }
      }
    }
    // Pause déjeuner bloquée le vendredi pour Thomas
    const fri = addDays(weekStart, w * 7 + 4);
    const blockStart = new Date(new TZDate(fri.getFullYear(), fri.getMonth(), fri.getDate(), 12, 30, 0, TZ).getTime());
    rows.push({ businessId: bid, kind: "block", startsAt: blockStart, endsAt: new Date(blockStart.getTime() + 45 * 60000), memberId: mThomas!.id, internalNote: "Pause" });
  }

  // On insère un par un en ignorant un éventuel conflit avec le blocage du vendredi.
  let inserted = 0;
  for (const r of rows) {
    try {
      await db.insert(s.appointments).values(r);
      inserted++;
    } catch (error) {
      const e = error as { code?: string; cause?: { code?: string } };
      if (e.code !== "23P01" && e.cause?.code !== "23P01") throw error;
    }
  }

  console.log(`Démo créée : ${custs.length} clients, ${svc.length} prestations, ${inserted} rendez-vous.`);
  console.log(`Connexion : claire@cabinet-horizon.example (propriétaire) ou thomas@cabinet-horizon.example (collaborateur), mot de passe ${DEMO_PASSWORD}`);
  console.log(`Super-admin : admin@branshee.example (même mot de passe) → /admin`);
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
