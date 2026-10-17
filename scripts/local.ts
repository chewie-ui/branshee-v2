/**
 * Lance Branshee en local avec sa propre base PostgreSQL, sans rien installer d'autre que Node.
 *   npm run local      (ou double-clic sur demarrer-local.bat sous Windows)
 *
 * - La base vit dans le dossier `.local/` (ignoré par git) et est conservée entre deux lancements.
 * - Au premier lancement : création de la base, migrations, données de démo.
 * - Les emails ne partent pas : ils s'affichent dans ce terminal.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";
import { runMigrations } from "./migrate";

const ROOT = resolve(".");
const DIR = join(ROOT, ".local");
const PG_DIR = join(DIR, "pgdata");
const PG_PORT = Number(process.env.LOCAL_PG_PORT ?? 5544);
const APP_PORT = Number(process.env.PORT ?? 3000);
const URL = `postgres://postgres:postgres@localhost:${PG_PORT}/branshee`;

function secret(name: string, bytes: number) {
  const file = join(DIR, name);
  if (!existsSync(file)) writeFileSync(file, randomBytes(bytes).toString("hex"));
  return readFileSync(file, "utf8").trim();
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawn(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const firstRun = !existsSync(join(PG_DIR, "PG_VERSION"));
  const pg = new EmbeddedPostgres({ databaseDir: PG_DIR, user: "postgres", password: "postgres", port: PG_PORT, persistent: true, onLog: () => {} });

  console.log(firstRun ? "▶ Première installation de la base de données (30 s environ)…" : "▶ Démarrage de la base de données…");
  if (firstRun) await pg.initialise();
  await pg.start();

  const admin = postgres(`postgres://postgres:postgres@localhost:${PG_PORT}/postgres`, { max: 1, onnotice: () => {} });
  const [exists] = await admin`select 1 from pg_database where datname = 'branshee'`;
  if (!exists) await admin.unsafe("create database branshee");
  await admin.end();

  console.log("▶ Mise à jour du schéma…");
  await runMigrations(URL);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: URL,
    APP_URL: `http://localhost:${APP_PORT}`,
    DATA_ENCRYPTION_KEY: secret("encryption-key", 32),
    CRON_SECRET: secret("cron-secret", 16),
    PORT: String(APP_PORT),
  };

  const db = postgres(URL, { max: 1 });
  const [{ n }] = await db`select count(*)::int as n from users`;
  await db.end();
  if (n === 0) {
    console.log("▶ Ajout des données de démo…");
    await new Promise<void>((ok, ko) => run("npx", ["tsx", "scripts/seed.ts"], env).on("exit", (c) => (c === 0 ? ok() : ko(new Error("Échec des données de démo")))));
  }

  console.log(`
────────────────────────────────────────────────────────
  Branshee tourne sur   http://localhost:${APP_PORT}

  Pro (propriétaire)  claire@cabinet-horizon.example
  Pro (collaborateur) thomas@cabinet-horizon.example
  Super-admin         admin@branshee.example   → /admin
  Mot de passe        demo-branshee-2026

  Page publique       http://localhost:${APP_PORT}/cabinet-horizon
  Arrêter             Ctrl + C
────────────────────────────────────────────────────────
`);

  const app = run("npx", ["next", "dev", "-p", String(APP_PORT)], env);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    app.kill();
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  app.on("exit", stop);
}

main().catch(async (e) => {
  console.error("\n✖ Le lancement a échoué :", e instanceof Error ? e.message : e);
  process.exit(1);
});
