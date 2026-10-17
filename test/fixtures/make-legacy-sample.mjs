// Génère un faux export de l'ancienne base (format mongoexport --jsonArray, JSON étendu).
// Données 100 % fictives, construites pour couvrir les cas limites connus.
import { writeFileSync, mkdirSync } from "node:fs";
import bcrypt from "bcryptjs";

const out = process.argv[2] ?? "test/fixtures/legacy-sample";
mkdirSync(out, { recursive: true });
let n = 0;
const oid = () => ({ $oid: (++n).toString(16).padStart(24, "0") });
const d = (iso) => ({ $date: iso });
const pw = bcrypt.hashSync("ancien-mdp-123", 8);

const uOwner = oid(), uCollab = oid(), uOwner2 = oid(), uClientDup = oid();
const cKine = oid(), cSalon = oid(), cDeleted = oid();
const gAdmin = oid(), gCollab = oid();
const emp = oid();
const svcSeance = oid(), svcBilan = oid(), svcPilates = oid();
const qId = oid(), optNew = oid();
const sched = (days, start = "09:00", end = "17:00") => [0, 1, 2, 3, 4, 5, 6].map((i) => ({ weekdayIndex: i, dayOff: !days.includes(i), workingHours: days.includes(i) ? [{ start, end }] : [] }));

const users = [
  { _id: uOwner, fullName: "Anne Lemoine", email: "Anne.Lemoine@Exemple.be", password: pw, company: cKine, businessName: "Kiné Lemoine", phone: "0470 11 22 33", preferredLang: "fr", subscription: { plan: "pro", status: "active", stripeCustomerId: "cus_TEST1", stripeSubscriptionId: "sub_TEST1" }, smsBalanceCents: 1250, notifications: { newBooking: true, cancellation: false }, calendarSettings: { reminderDelayHours: 48, confirmationMessage: "Prévoir une serviette.", phoneRequired: true, accentColor: "#0d9488", showSectionFaq: true, faq: [{ question: "Parking ?", answer: "Oui, gratuit." }], categories: [{ name: "Kinésithérapie", icon: "" }] }, googleCalendar: { connected: true, email: "anne@gmail.example", refreshToken: "1//refresh-token-fictif" }, twoFA: { enabled: true, secret: "BASE32" }, createdAt: d("2025-09-01T10:00:00Z") },
  { _id: uCollab, fullName: "Marc Dupont", email: "marc@exemple.be", password: pw, createdAt: d("2025-10-01T10:00:00Z") },
  { _id: uOwner2, fullName: "Léa Martin", email: "lea@exemple.be", password: pw, company: cSalon, subscription: { plan: "essentiel", status: "active" }, manualPremium: true, manualPremiumExpiry: d("2027-01-01T00:00:00Z"), createdAt: d("2025-11-01T10:00:00Z") },
];
const clients = [
  { _id: uClientDup, fullName: "Marc Dupont", email: "MARC@exemple.be", password: pw }, // même email qu'un pro → fusion
  { _id: oid(), fullName: "Paul Client", email: "paul@exemple.be", password: pw, phone: "0499 00 00 01" },
];
const companies = [
  { _id: cKine, owner: uOwner, name: "Kiné Lemoine", slug: "kine-lemoine", businessType: "Kinésithérapie", location: { address: "Rue Fictive 3", city: "Wavre", zip: 1300 }, scheduleMode: "perEmployee", slotTime: 30, bufferTime: 10, minBookingLeadTime: { enabled: true, minutes: 120 }, bookingHorizonDays: 60, autoConfirm: false, schedule: sched([1, 2, 3, 4, 5]), bookingQuestion: { enabled: true }, serviceQuestionnaire: { enabled: true, questions: [{ _id: qId, question: "Motif ?", options: [{ _id: optNew, label: "Douleur" }, { _id: oid(), label: "Sport" }] }] }, ownerEmployeeProfile: { isEmployee: true, displayName: "Anne L.", schedule: sched([1, 2, 4], "08:00", "12:00") }, acceptedPayments: { cash: true, bankTransfer: { enabled: true, iban: "BE00 0000 0000 0000" } }, cancellationPolicy: { rule: "half_24h" }, createdAt: d("2025-09-01T10:00:00Z") },
  { _id: cSalon, owner: uOwner2, name: "Salon Léa", slug: "kine-lemoine", businessType: "Coiffure", schedule: sched([2, 3, 4, 5, 6]), createdAt: d("2025-11-01T10:00:00Z") }, // slug en double
  { _id: cDeleted, owner: uOwner2, name: "Ancien salon", isDeleted: true },
];
const companygrades = [
  { _id: gAdmin, company: cKine, name: "Administrateur", isBuiltIn: true, permissions: { appointments: { view: true, manage: true, cancelDelete: true }, clients: { view: true, manage: true }, collaborators: { view: true, manage: true } } },
  { _id: gCollab, company: cKine, name: "Collaborateur", isBuiltIn: true, permissions: { appointments: { view: true, manage: true }, availability: { manageOwnSchedule: true } } },
];
const companymemberships = [
  { _id: oid(), company: cKine, user: uCollab, status: "accepted", grade: gCollab, canManageOwnTimeOff: true, isEmployee: true, schedule: sched([1, 3, 5], "13:00", "19:00"), acceptedAt: d("2025-10-02T10:00:00Z") },
  { _id: oid(), company: cKine, user: uOwner, status: "accepted", grade: gAdmin }, // le propriétaire figure aussi ici
];
const employees = [{ _id: emp, company: cKine, firstName: "Sophie", lastName: "Ancien-Modèle", active: true }];
const daysoffs = [{ _id: oid(), company: cKine, dates: [
  { date: d("2026-12-25T00:00:00Z"), dayOff: true, employees: [] },
  { date: d("2026-11-10T00:00:00Z"), dayOff: true, employees: [uCollab] },
  { date: d("2026-11-12T00:00:00Z"), dayOff: false, workingHours: [{ start: "10:00", end: "12:00" }], employees: [uOwner] },
] }];
const services = [
  { _id: svcSeance, company: cKine, name: "Séance", price: 30, duration: 30, category: "Kinésithérapie", employees: [uOwner, uCollab], color: "#2563eb", order: 1 },
  { _id: svcBilan, company: cKine, name: "Bilan", price: 45.5, duration: 45, category: "Bilans", answerVisibility: "new", questionRules: [{ questionId: qId, optionIds: [optNew] }] }, // catégorie absente de la liste
  { _id: svcPilates, company: cKine, name: "Pilates", price: 15, duration: 60, type: "group", capacity: 6, employees: [uOwner], sessions: [{ date: d("2026-11-03T00:00:00Z"), startTime: "18:00", endTime: "19:00" }] },
  { _id: oid(), company: cSalon, name: "Coupe", price: null, duration: 40, active: false },
];
const forms = [{ _id: oid(), company: cKine, active: true, questions: [{ label: "Avez-vous une prescription ?", type: "yes_no", required: true, order: 0 }] }, { _id: oid(), company: cSalon, active: false, questions: [{ label: "Ignorée", type: "text" }] }];
const dossierKeyMail = "mail:paul@exemple.be";
const clientdossiers = [{ _id: oid(), company: uOwner /* ancien : pointe vers le User */, email: "paul@exemple.be", clientKey: dossierKeyMail, fullName: "Paul Client", phone: "0499 00 00 01", generalInfo: "Antécédent : entorse cheville 2024", entries: [{ date: d("2026-10-01T00:00:00Z"), title: "Séance 1", note: "Mobilité réduite", todo: "Exercices" }] }];
const tok = (i) => i.toString(16).padStart(64, "a");
const bk = (o) => ({ _id: oid(), slotTime: 30, status: "confirmed", cancelToken: tok(++n), createdAt: d("2026-10-01T09:00:00Z"), ...o });
const bookings = [
  bk({ company: cKine, date: d("2026-11-02T00:00:00Z"), startTime: "09:00", endTime: "09:30", name: "Paul", surname: "Client", email: "paul@exemple.be", phone: "0499000001", service: svcSeance, serviceName: "Séance", employee: uOwner, payment: { method: "cash", status: "paid", amount: 30 } }),
  bk({ company: uOwner /* ancien format */, date: d("2026-11-02T00:00:00Z"), startTime: "09:15", endTime: "09:45", name: "Julie", surname: "Chevauche", email: "julie@exemple.be", service: svcSeance, employee: uOwner }), // chevauche le précédent
  bk({ company: cKine, date: d("2026-11-02T00:00:00Z"), startTime: "13:00", endTime: "13:45", name: "Nora", phone: "0477 12 34 56", service: svcBilan, employee: uCollab, status: "pending" }),
  bk({ company: cKine, date: d("2026-11-03T00:00:00Z"), startTime: "10:00", endTime: "", name: "Sans", surname: "Fin", email: "sansfin@exemple.be", employee: emp }), // heure de fin manquante, ancien Employee
  bk({ company: cKine, date: d("2026-11-03T00:00:00Z"), startTime: "18:00", endTime: "19:00", name: "Yoga", surname: "Fan", email: "pil@exemple.be", service: svcPilates, isGroup: true }),
  bk({ company: cKine, date: d("2026-11-04T00:00:00Z"), startTime: "12:00", endTime: "13:00", isBlock: true, adminNotes: "Pause midi", employee: uOwner }),
  bk({ company: cKine, date: d("2026-10-20T00:00:00Z"), startTime: "11:00", endTime: "11:30", name: "Paul", surname: "Client", email: "paul@exemple.be", status: "canceled", noShow: false }),
  bk({ company: cKine, date: d("2026-10-21T00:00:00Z"), startTime: "25:00", endTime: "26:00", name: "Heure", surname: "Invalide" }), // ignoré
  bk({ company: cDeleted, date: d("2026-10-21T00:00:00Z"), startTime: "10:00", endTime: "10:30", name: "Établissement", surname: "Supprimé" }), // ignoré
];
const reviews = [{ _id: oid(), company: cKine, client: uClientDup, clientName: "Marc", rating: 5, comment: "Top" }];
const reviewreports = [{ _id: oid(), review: reviews[0]._id, company: cKine, reporterKind: "owner", reason: "false", snapshot: { clientName: "Marc", rating: 5, comment: "Top" }, status: "pending" }];
const sites = [{ _id: oid(), company: cKine, slug: "kine-lemoine", isPublished: true, theme: { primaryColor: "#0d9488", roundness: "soft", siteTemplate: "2" }, sections: [{ id: "h1", type: "hero", enabled: true, data: { title: "Bienvenue" } }] }];
const promocodes = [{ _id: oid(), code: "bienvenue", discountType: "percent", discountValue: 20, usedByUsers: [uOwner2], applicablePlan: "business_monthly" }];
const accesslinks = [{ _id: oid(), code: "offert30", plan: "pro", uses: [{ userId: uOwner2, email: "lea@exemple.be" }] }];
const articles = [{ _id: oid(), title: "Réduire les absences", slug: "reduire-absences", status: "published", publishedAt: d("2026-09-01T00:00:00Z"), contentHtml: "<p>Texte</p>" }];
const featureflags = [{ _id: oid(), key: "booking", label: "Réservation", status: "active" }];
const jobtitles = [{ _id: oid(), name: "Kinésithérapie", key: "kinesitherapie", status: "approved" }];
const supportchats = [{ _id: oid(), user: uOwner, messages: [{ sender: "user", text: "Bonjour", createdAt: d("2026-09-02T10:00:00Z") }, { sender: "admin", text: "Bonjour Anne !" }] }];
const adminmessages = [{ _id: oid(), broadcast: true, title: "Nouveauté", body: "La v2 arrive.", dismissedBy: [uOwner] }];
const activitylogs = [{ _id: oid(), company: cKine, user: uOwner, userName: "Anne", action: "booking.create", description: "RDV créé", createdAt: d("2026-10-01T09:00:00Z") }];

const all = { users, clients, companies, companygrades, companymemberships, employees, daysoffs, services, forms, clientdossiers, bookings, reviews, reviewreports, sites, promocodes, accesslinks, articles, featureflags, jobtitles, supportchats, adminmessages, activitylogs };
for (const [name, docs] of Object.entries(all)) writeFileSync(`${out}/${name}.json`, JSON.stringify(docs, null, 1));
console.log(`Échantillon écrit dans ${out}`);
