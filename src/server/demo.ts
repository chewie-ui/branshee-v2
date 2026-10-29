import "server-only";
import { randomBytes } from "node:crypto";
import { TZDate } from "@date-fns/tz";
import { addDays, startOfWeek } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments, businessPlans, businesses, customerNotes, customers, invoiceSettings, loyaltyCards, loyaltySettings, members, notificationSettings,
  products, salesDocuments, serviceHours, serviceMembers, services, todoLists, todoTasks, users,
} from "@/db/schema";
import { encrypt } from "@/lib/field-crypto";
import { formatNumber, structComm } from "@/lib/invoicing";
import { hashPassword } from "@/server/auth/password";
import { createBusiness } from "@/server/business";

/**
 * Démo publique de Skydev (skydev.be/demo) : un compte et une entreprise fictifs, en lecture seule,
 * recréés chaque jour pour que l'agenda tombe toujours sur la semaine en cours. Aucune donnée réelle,
 * aucun email ni téléphone de client (rien ne peut partir).
 */
const DEMO_EMAIL = "demo@demo.skydev.be";
const TZ = "Europe/Brussels";

async function demoUser() {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  if (u) return u.id;
  // Mot de passe aléatoire jamais communiqué : on n'entre dans la démo que par skydev.be/demo.
  const [created] = await db.insert(users).values({ email: DEMO_EMAIL, fullName: "Visiteur", passwordHash: await hashPassword(randomBytes(24).toString("base64url")), emailVerifiedAt: new Date(), isDemo: true, signupIntent: "pro" }).onConflictDoNothing().returning({ id: users.id });
  if (created) return created.id;
  const [again] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  return again!.id;
}

/** L'entreprise de démo du jour (créée si besoin). */
export async function ensureDemo() {
  const userId = await demoUser();
  const [b] = await db.select({ id: businesses.id, createdAt: businesses.createdAt }).from(businesses).where(and(eq(businesses.ownerId, userId), eq(businesses.isDemo, true)));
  const fresh = b && new TZDate(b.createdAt, TZ).toDateString() === new TZDate(new Date(), TZ).toDateString();
  if (b && fresh) return { userId, businessId: b.id };
  if (b) await db.delete(businesses).where(eq(businesses.id, b.id));
  return { userId, businessId: await seed(userId) };
}

async function seed(userId: string) {
  const { business, member } = await createBusiness({ id: userId, fullName: "Julie Martin" }, { name: "Cabinet Équilibre (démo)", businessType: "Kinésithérapeute", city: "Wavre" }, { trial: false, brand: "skydev" });
  const bid = business.id;
  const mid = member.id;
  await db.update(businesses).set({ isDemo: true, onboarding: { appsSetupAt: new Date().toISOString(), hiddenApps: [] }, address: "Rue de la Démo 1", postalCode: "1300" }).where(eq(businesses.id, bid));
  await db.insert(businessPlans).values({ businessId: bid, plan: "pro_plus", status: "active", isTrial: false, grantedUntil: new Date("2099-12-31T00:00:00Z"), stripeSubscriptionId: null, grantReminder: {} });
  await db.update(notificationSettings).set({ smsReminders: false }).where(eq(notificationSettings.businessId, bid));

  // Prestations.
  const svcDefs = [
    { name: "Séance de kinésithérapie", durationMin: 30, priceCents: 3000, color: "#4f46e5" },
    { name: "Bilan initial", durationMin: 60, priceCents: 4500, color: "#0d9488" },
    { name: "Drainage lymphatique", durationMin: 45, priceCents: 4000, color: "#db2777" },
    { name: "Massage sportif", durationMin: 30, priceCents: 3500, color: "#ea580c" },
  ];
  const svc = await db.insert(services).values(svcDefs.map((s, i) => ({ businessId: bid, ...s, isActive: true, position: i + 1 }))).returning({ id: services.id, durationMin: services.durationMin, name: services.name });
  await db.insert(serviceMembers).values(svc.map((s) => ({ serviceId: s.id, memberId: mid })));
  await db.insert(serviceHours).values({ serviceId: svc[2]!.id, weekday: 4, startTime: "14:00", endTime: "17:00" });

  // Clients fictifs, sans email ni téléphone.
  const names = ["Léa Dumont", "Thomas Lambert", "Sarah Peeters", "Lucas Dubois", "Emma Jacobs", "Hugo Maes", "Chloé Willems", "Nathan Claes"];
  const cust = await db.insert(customers).values(names.map((n) => ({ businessId: bid, fullName: n, firstName: n.split(" ")[0], lastName: n.split(" ")[1], street: "Rue de l'Exemple 12", postalCode: "1300", city: "Wavre", createdManually: true }))).returning({ id: customers.id, name: customers.fullName });

  // Agenda de la semaine en cours.
  const monday = startOfWeek(new TZDate(new Date(), TZ), { weekStartsOn: 1 });
  const at = (dayOffset: number, h: number, m = 0) => { const d = addDays(monday, dayOffset); return new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), h, m, TZ); };
  const plan: [number, number, number, number, number][] = [
    [0, 9, 0, 0, 1], [0, 10, 0, 0, 0], [0, 14, 30, 2, 3], [1, 9, 30, 1, 2], [1, 11, 0, 3, 0], [1, 16, 0, 4, 0],
    [2, 8, 30, 5, 0], [2, 13, 0, 6, 3], [3, 14, 0, 7, 2], [3, 15, 0, 0, 2], [3, 10, 0, 1, 0], [4, 9, 0, 2, 0], [4, 11, 30, 3, 1], [4, 15, 0, 4, 3],
  ];
  await db.insert(appointments).values(plan.map(([d, h, m, c, s]) => {
    const start = at(d, h, m);
    return { businessId: bid, memberId: mid, serviceId: svc[s]!.id, customerId: cust[c]!.id, contactName: cust[c]!.name, startsAt: new Date(start), endsAt: new Date(start.getTime() + svc[s]!.durationMin * 60000), status: "confirmed" as const, manageToken: randomBytes(16).toString("base64url"), source: "online" as const };
  }));

  // Dossier d'un patient (notes chiffrées comme les vraies).
  await db.insert(customerNotes).values([
    { customerId: cust[0]!.id, date: new TZDate(addDays(monday, -7), TZ).toISOString().slice(0, 10), title: "Bilan genou droit", noteEnc: encrypt("Douleur à la montée des escaliers. Amplitude 0–110°. Renforcement quadriceps, 2 séances par semaine."), authorMemberId: mid },
    { customerId: cust[0]!.id, date: new TZDate(addDays(monday, -2), TZ).toISOString().slice(0, 10), title: "Séance 3", noteEnc: encrypt("Nette amélioration, plus de douleur à la marche. Continuer les exercices à domicile."), authorMemberId: mid },
  ]);

  // Factures : réglages vendeur fictifs, 2 factures émises et 1 devis.
  await db.insert(invoiceSettings).values({ businessId: bid, legalName: "Julie Martin", tradeName: "Cabinet Équilibre", street: "Rue de la Démo 1", zip: "1300", city: "Wavre", bce: "0000000097", email: "", iban: "BE68539007547034", vatRegime: "franchise" });
  const year = new Date().getFullYear();
  const seller = { legalName: "Julie Martin", tradeName: "Cabinet Équilibre", legalForm: "Personne physique", street: "Rue de la Démo 1", zip: "1300", city: "Wavre", country: "Belgique", bce: "0000000097", iban: "BE68539007547034", vatRegime: "franchise", color: "#4f46e5" };
  const client = (i: number) => ({ name: cust[i]!.name, contact: "", email: "", phone: "", vat: "", street: "Rue de l'Exemple 12", zip: "1300", city: "Wavre", country: "" });
  const day = (n: number) => new TZDate(addDays(new Date(), n), TZ).toISOString().slice(0, 10);
  const line = (desc: string, qty: number, price: number) => ({ id: randomBytes(4).toString("hex"), desc, qty, unit: "séance", price, vat: 0 });
  await db.insert(salesDocuments).values([
    { businessId: bid, docType: "invoice", status: "paid", year, seq: 1, number: formatNumber("invoice", year, 1), comm: structComm(year, 1, "invoice"), issueDate: day(-12), serviceDate: day(-12), dueDate: day(3), paidDate: day(-5), customerId: cust[0]!.id, seller, client: client(0), lines: [line("Séances de kinésithérapie", 4, 30)], htCents: 12000, vatCents: 0, ttcCents: 12000, issuedAt: new Date(), createdById: userId },
    { businessId: bid, docType: "invoice", status: "sent", year, seq: 2, number: formatNumber("invoice", year, 2), comm: structComm(year, 2, "invoice"), issueDate: day(-3), serviceDate: day(-3), dueDate: day(12), customerId: cust[1]!.id, seller, client: client(1), lines: [line("Bilan initial", 1, 45), line("Séance de kinésithérapie", 2, 30)], htCents: 10500, vatCents: 0, ttcCents: 10500, issuedAt: new Date(), createdById: userId },
    { businessId: bid, docType: "quote", status: "sent", year, seq: 1, number: formatNumber("quote", year, 1), issueDate: day(-1), validUntil: day(29), customerId: cust[2]!.id, seller, client: client(2), lines: [line("Programme de rééducation (10 séances)", 10, 30)], htCents: 30000, vatCents: 0, ttcCents: 30000, createdById: userId },
  ]);

  // Tâches, stock, fidélité.
  const [list] = await db.insert(todoLists).values({ businessId: bid, name: "Cabinet", color: "blue", createdByMemberId: mid }).returning({ id: todoLists.id });
  await db.insert(todoTasks).values([
    { businessId: bid, listId: list!.id, title: "Commander des bandes de kinésio", dueDate: day(0), priority: 2, createdByMemberId: mid, position: 1 },
    { businessId: bid, listId: list!.id, title: "Rappeler la mutuelle de M. Lambert", dueDate: day(1), dueTime: "10:00", priority: 1, createdByMemberId: mid, position: 2 },
    { businessId: bid, listId: list!.id, title: "Mettre à jour les horaires de Noël", dueDate: day(5), createdByMemberId: mid, position: 3 },
  ]);
  await db.insert(products).values([
    { businessId: bid, name: "Bande de kinésio 5 cm", priceCents: 1290, stockQty: 3, minQty: 5, category: "Consommables" },
    { businessId: bid, name: "Huile de massage 500 ml", priceCents: 1850, stockQty: 12, minQty: 4, category: "Consommables" },
    { businessId: bid, name: "Balle de massage", priceCents: 990, stockQty: 20, minQty: 5, category: "Vente" },
  ]);
  await db.insert(loyaltySettings).values({ businessId: bid, goal: 10, reward: "Une séance offerte", qrEnabled: true, autoAppointment: true });
  await db.insert(loyaltyCards).values([0, 1, 4].map((i, k) => ({ businessId: bid, customerId: cust[i]!.id, stamps: [7, 3, 10][k]!, token: randomBytes(16).toString("base64url"), lastStampAt: new Date() })));
  return bid;
}
