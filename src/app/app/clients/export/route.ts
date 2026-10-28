import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { currentBrand } from "@/server/brand";
import { requireContext } from "@/server/context";
import { csvResponse, toCsv } from "@/server/csv";

/**
 * Export du fichier clients (coordonnées seulement : jamais les notes ni les dossiers).
 * Reste disponible en lecture seule : l'entreprise garde toujours accès à ses données.
 */
export async function GET() {
  const ctx = await requireContext("customers.view");
  if ((await currentBrand()).id !== "skydev") notFound();
  const rows = await db
    .select({ name: customers.fullName, first: customers.firstName, last: customers.lastName, email: customers.email, phone: customers.phone, company: customers.companyName, vat: customers.vatNumber, street: customers.street, zip: customers.postalCode, city: customers.city, country: customers.country })
    .from(customers)
    .where(eq(customers.businessId, ctx.business.id))
    .orderBy(asc(customers.fullName));
  const csv = toCsv(["Nom complet", "Prénom", "Nom", "Email", "Téléphone", "Société", "N° de TVA", "Adresse", "Code postal", "Ville", "Pays"], rows.map((r) => [r.name, r.first, r.last, r.email, r.phone, r.company, r.vat, r.street, r.zip, r.city, r.country]));
  return csvResponse("clients.csv", csv);
}
