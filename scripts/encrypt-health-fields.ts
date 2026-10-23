/**
 * Chiffre les données de santé déjà en base (motif du patient, réponses au questionnaire, note interne).
 *   npm run encrypt:health            (relançable : relit puis réécrit, la valeur est chiffrée à l'écriture)
 * Nécessite DATA_ENCRYPTION_KEY et DATABASE_URL (la config de l'app).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant");
if (!process.env.DATA_ENCRYPTION_KEY) throw new Error("DATA_ENCRYPTION_KEY manquant");

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema: s, casing: "snake_case" });

// Pas d'`await` au premier niveau : tsx compile ce script en CommonJS.
(async () => {
  // Lignes qui contiennent encore du texte en clair dans au moins un des trois champs.
  const todo = await db.execute<{ id: string }>(sql`
    select id from appointments
    where (customer_message is not null and customer_message <> '' and customer_message not like 'v1.%')
       or (internal_note is not null and internal_note <> '' and internal_note not like 'v1.%')
       or exists (select 1 from jsonb_array_elements(form_answers) a where coalesce(a->>'answer', '') <> '' and a->>'answer' not like 'v1.%')`);
  let n = 0;
  for (const { id } of todo) {
    const [row] = await db.select({ m: s.appointments.customerMessage, f: s.appointments.formAnswers, note: s.appointments.internalNote }).from(s.appointments).where(eq(s.appointments.id, id));
    if (!row) continue;
    await db.update(s.appointments).set({ customerMessage: row.m, formAnswers: row.f, internalNote: row.note }).where(eq(s.appointments.id, id));
    n++;
  }
  const [left] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from appointments
    where (customer_message <> '' and customer_message not like 'v1.%') or (internal_note <> '' and internal_note not like 'v1.%')
       or exists (select 1 from jsonb_array_elements(form_answers) a where coalesce(a->>'answer', '') <> '' and a->>'answer' not like 'v1.%')`);
  console.log(`✔ ${n} rendez-vous chiffrés · reste en clair : ${left?.n ?? "?"}`);
  await client.end();
})();
