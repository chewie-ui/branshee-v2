/**
 * Applique les migrations Drizzle puis les contraintes SQL personnalisées.
 * Remplace `drizzle-kit migrate && psql …` : fonctionne aussi sans `psql` installé (Windows).
 */
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export async function runMigrations(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle/migrations" });
    await client.unsafe(readFileSync("drizzle/custom/0001_constraints.sql", "utf8"));
  } finally {
    await client.end();
  }
}

// Lancé directement : `npm run db:migrate`
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/migrate.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant");
  runMigrations(url).then(() => console.log("Base de données à jour."));
}
