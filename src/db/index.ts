import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// La connexion est ouverte à la première requête : le build peut tourner sans base (CI).
const url = process.env.DATABASE_URL;
if (!url && process.env.NEXT_PHASE !== "phase-production-build") console.error("DATABASE_URL manquant dans l'environnement");

// Une seule connexion réutilisée en développement (rechargements à chaud).
const globalForDb = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client = globalForDb.pg ?? postgres(url ?? "postgres://localhost:5432/branshee", { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.pg = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
