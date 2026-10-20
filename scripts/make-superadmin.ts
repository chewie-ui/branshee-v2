/**
 * Donne (ou retire) le rôle super-admin à un compte existant.
 *   npm run admin:grant -- quentin@exemple.com
 *   npm run admin:grant -- quentin@exemple.com --remove
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as s from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant");
const email = process.argv[2]?.toLowerCase();
if (!email) throw new Error("Usage : npm run admin:grant -- <email> [--remove]");
const remove = process.argv.includes("--remove");

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema: s, casing: "snake_case" });
// Pas d'`await` au premier niveau : tsx compile ce script en CommonJS.
(async () => {
  const rows = await db.update(s.users).set({ isSuperadmin: !remove }).where(sql`lower(${s.users.email}) = ${email}`).returning({ email: s.users.email });
  console.log(rows.length ? `${rows[0]!.email} : super-admin ${remove ? "retiré" : "activé"}.` : `Aucun compte avec l'email ${email}. Inscrivez-vous d'abord sur l'app.`);
  await client.end();
})();
