#!/usr/bin/env node
/**
 * Transfert Branshee → Skydev (bascule du 22/11/2026).
 *
 * Copie toutes les données de la base Branshee (comptes pros ET clients, établissements, patients, rendez-vous,
 * dossiers, abonnements…) dans la base Skydev, plus les fichiers (logos, photos, pièces jointes chiffrées).
 * La structure Branshee est un sous-ensemble de celle de Skydev (mêmes migrations 0000-0017 + question_services) :
 * chaque ligne est recopiée telle quelle, les colonnes propres à Skydev prennent leur valeur par défaut.
 *
 *   - Une personne qui a déjà un compte Skydev (même email) : comptes fusionnés (le compte Skydev est gardé,
 *     tout ce qui pointait vers le compte Branshee pointe vers lui).
 *   - Champs chiffrés (« v1.… ») et pièces jointes (« BSE1… ») : rechiffrés avec la clé Skydev si elle diffère.
 *   - Établissements : marque « branshee » (mêmes prix et mêmes règles qu'avant, jamais en lecture seule).
 *   - Sessions, codes de vérification, statistiques et contenus de la plateforme : non copiés.
 *
 * N'affiche jamais de donnée : seulement des nombres et des noms de tables.
 *
 *   MODE=essai  tout est fait dans une transaction annulée à la fin (rien n'est écrit), fichiers seulement comptés
 *   MODE=reel   transaction validée, puis fichiers copiés
 *
 * Variables : SRC_DATABASE_URL, DST_DATABASE_URL, SRC_KEY, DST_KEY (DATA_ENCRYPTION_KEY de chaque site),
 *             SRC_STORAGE, DST_STORAGE (dossiers STORAGE_DIR), MODE.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const MODE = process.env.MODE === "reel" ? "reel" : "essai";
const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Variable manquante : ${k}`); process.exit(2); } return v; };
const SRC_KEY = Buffer.from(need("SRC_KEY"), "hex");
const DST_KEY = Buffer.from(need("DST_KEY"), "hex");
const SAME_KEY = SRC_KEY.equals(DST_KEY);
const src = postgres(need("SRC_DATABASE_URL"), { max: 1, onnotice: () => {} });
const dst = postgres(need("DST_DATABASE_URL"), { max: 1, onnotice: () => {} });

/** Tables propres à chaque plateforme (ou jetables) : jamais copiées. */
const SKIP = new Set([
  "sessions", "verification_codes", "login_events", "page_views", "email_logs",
  "modules", "feature_flags", "help_sections", "job_titles", "articles", "admin_messages", "admin_message_dismissals",
  "promo_campaigns", "promo_codes", "promo_redemptions", "supervision_requests",
  "__drizzle_migrations",
]);

// ---------- chiffrement ----------
const V1 = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
function reseal(s) {
  const [, iv, tag, data] = s.split(".");
  const d = createDecipheriv("aes-256-gcm", SRC_KEY, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  const plain = Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]);
  const iv2 = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", DST_KEY, iv2);
  const out = Buffer.concat([c.update(plain), c.final()]);
  return ["v1", iv2.toString("base64url"), c.getAuthTag().toString("base64url"), out.toString("base64url")].join(".");
}
let resealed = 0;
function resealDeep(v) {
  if (SAME_KEY) return v;
  if (typeof v === "string") { if (V1.test(v)) { resealed++; return reseal(v); } return v; }
  if (Array.isArray(v)) return v.map(resealDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resealDeep(x)]));
  return v;
}
const MAGIC = Buffer.from("BSE1");
function resealFile(blob) {
  const d = createDecipheriv("aes-256-gcm", SRC_KEY, blob.subarray(4, 16));
  d.setAuthTag(blob.subarray(16, 32));
  const plain = Buffer.concat([d.update(blob.subarray(32)), d.final()]);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", DST_KEY, iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}

// ---------- structure ----------
async function tables(sql) {
  return (await sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`).map((r) => r.table_name);
}
async function columns(sql) {
  const m = new Map();
  for (const r of await sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`) {
    if (!m.has(r.table_name)) m.set(r.table_name, new Set());
    m.get(r.table_name).add(r.column_name);
  }
  return m;
}
async function foreignKeys(sql) {
  return sql`
    select c.conrelid::regclass::text as tbl, a.attname as col, c.confrelid::regclass::text as ref, af.attname as refcol, not a.attnotnull as nullable
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
    join lateral unnest(c.confkey) with ordinality f(attnum, ord) on f.ord = k.ord
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    join pg_attribute af on af.attrelid = c.confrelid and af.attnum = f.attnum
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1`;
}
async function primaryKeys(sql) {
  const m = new Map();
  for (const r of await sql`
    select c.conrelid::regclass::text as tbl, array_agg(a.attname order by k.ord) as cols
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'p' and c.connamespace = 'public'::regnamespace group by 1`) m.set(r.tbl, r.cols);
  return m;
}

function topoOrder(list, fks) {
  const deps = new Map(list.map((t) => [t, new Set()]));
  for (const f of fks) if (deps.has(f.tbl) && deps.has(f.ref) && f.tbl !== f.ref) deps.get(f.tbl).add(f.ref);
  const out = [], seen = new Set(), temp = new Set();
  const visit = (t) => {
    if (seen.has(t)) return;
    if (temp.has(t)) return; // cycle : l'ordre restant suffit (clés facultatives)
    temp.add(t);
    for (const d of deps.get(t)) visit(d);
    temp.delete(t); seen.add(t); out.push(t);
  };
  list.sort().forEach(visit);
  return out;
}

// ---------- fichiers ----------
async function walk(dir, base = dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, base, out);
    else if (e.isFile()) out.push(p.slice(base.length + 1));
  }
  return out;
}
async function exists(p) { try { await stat(p); return true; } catch { return false; } }

// ---------- transfert ----------
async function main() {
  console.log(`Transfert Branshee → Skydev — mode ${MODE.toUpperCase()}${SAME_KEY ? "" : " (clés de chiffrement différentes : rechiffrement)"}`);
  const [sT, dT, dCols, sCols, fks, pks] = await Promise.all([tables(src), tables(dst), columns(dst), columns(src), foreignKeys(dst), primaryKeys(dst)]);
  const missing = sT.filter((t) => !SKIP.has(t) && !dT.includes(t));
  if (missing.length) { console.error(`Tables Branshee absentes de Skydev : ${missing.join(", ")} — mettre Skydev à jour d'abord.`); process.exit(3); }
  const list = topoOrder(sT.filter((t) => !SKIP.has(t)), fks);
  const fkOf = (t) => fks.filter((f) => f.tbl === t);

  /** Correspondance des identifiants Branshee → Skydev (comptes fusionnés). */
  const idMap = new Map(); // "table" → Map(ancien → nouveau)
  const mapOf = (t) => { if (!idMap.has(t)) idMap.set(t, new Map()); return idMap.get(t); };
  /** Lignes non copiées (fusion) : leurs enfants suivent la ligne Skydev équivalente si on la connaît. */
  const report = [];
  const conflicts = [];
  let already = 0;

  const work = async (tx) => {
    // 1. Comptes : fusion par email (insensible à la casse).
    const existing = new Map((await tx`select id, lower(email) as e from users`).map((r) => [r.e, r.id]));
    const srcUsers = await src`select id, lower(email) as e from users`;
    let merged = 0;
    for (const u of srcUsers) { const d = existing.get(u.e); if (d) { mapOf("users").set(u.id, d); merged++; } }
    console.log(`Comptes : ${srcUsers.length} chez Branshee, dont ${merged} déjà sur Skydev (fusionnés)`);

    for (const t of list) {
      const cols = [...sCols.get(t)].filter((c) => dCols.get(t)?.has(c));
      const pk = pks.get(t) ?? [];
      const rows = await src`select to_jsonb(x) as r from ${src(t)} x`;
      let ins = 0, skipped = 0;
      const tf = fkOf(t);
      for (const { r } of rows) {
        // Compte fusionné : la ligne users n'est pas recopiée.
        if (t === "users" && mapOf("users").has(r.id)) { skipped++; continue; }
        const row = {};
        for (const c of cols) row[c] = resealDeep(r[c]);
        // Clés étrangères vers une ligne fusionnée → la ligne Skydev ; vers une table non copiée → vide si possible.
        let orphan = false;
        for (const f of tf) {
          if (row[f.col] == null) continue;
          const m = idMap.get(f.ref);
          if (m?.has(row[f.col])) row[f.col] = m.get(row[f.col]);
          else if (SKIP.has(f.ref) || !list.includes(f.ref)) {
            const [{ n }] = await tx`select count(*)::int as n from ${tx(f.ref)} where ${tx(f.refcol)} = ${row[f.col]}`;
            if (!n) { if (f.nullable) row[f.col] = null; else orphan = true; }
          }
        }
        if (orphan) { skipped++; continue; }
        if (t === "businesses") {
          if (!row.brand) row.brand = "branshee";
          // Pas de questionnaire « quelles apps ? » des nouveaux comptes Skydev : toutes les apps sur l'accueil.
          row.onboarding = { ...(row.onboarding ?? {}), appsSetupAt: row.onboarding?.appsSetupAt ?? new Date().toISOString() };
        }
        const used = Object.keys(row);
        try {
          await tx.savepoint(async (sp) => {
            await sp`insert into ${sp(t)} (${sp(used)}) select ${sp(used)} from jsonb_populate_record(null::${sp(t)}, ${sp.json(row)}::jsonb)`;
          });
          ins++;
        } catch (e) {
          // Doublon sur une ligne liée à un compte fusionné (portefeuille SMS, préférences…) : on garde celle de Skydev.
          const touchesMerged = tf.some((f) => f.ref === "users" && r[f.col] && mapOf("users").has(r[f.col])) && !/_pk(ey)?$/.test(e.constraint_name ?? "");
          if (e.code === "23505" && touchesMerged) {
            skipped++;
            // Si cette table est référencée par d'autres, relier l'ancienne ligne à la ligne Skydev équivalente.
            if (pk.length === 1) {
              const userFk = tf.find((f) => f.ref === "users" && r[f.col]);
              const [d] = userFk ? await tx`select ${tx(pk[0])} as id from ${tx(t)} where ${tx(userFk.col)} = ${row[userFk.col]} limit 1` : [];
              if (d) mapOf(t).set(r[pk[0]], d.id);
            }
          } else if (e.code === "23505" && /_pk(ey)?$/.test(e.constraint_name ?? "")) {
            // Même identifiant déjà présent : ligne déjà transférée (second passage).
            skipped++; already++;
          } else {
            conflicts.push(`${t} : ${e.code} ${e.constraint_name ?? ""} ${e.code === "23505" ? "" : (e.message ?? "").slice(0, 120)}`.trim());
            skipped++;
          }
        }
      }
      if (rows.length) report.push([t, rows.length, ins, skipped]);
    }
  };

  try {
    await dst.begin(async (tx) => {
      await work(tx);
      if (MODE === "essai") throw Object.assign(new Error("essai"), { rollbackOnly: true });
    });
  } catch (e) {
    if (!e.rollbackOnly) throw e;
  }

  console.log("\nTable                          Branshee  copiées  non copiées");
  for (const [t, n, i, s] of report) console.log(`${t.padEnd(30)} ${String(n).padStart(8)} ${String(i).padStart(8)} ${String(s).padStart(12)}`);
  console.log(`\nChamps chiffrés rechiffrés : ${resealed}`);
  if (already) console.log(`Lignes déjà transférées (ignorées) : ${already}`);
  const grouped = Object.entries(conflicts.reduce((a, c) => ((a[c] = (a[c] ?? 0) + 1), a), {}));
  if (grouped.length) { console.log(`\n⚠ Conflits (${conflicts.length}) :`); for (const [c, n] of grouped) console.log(`  ${n} × ${c}`); }
  else console.log("\n✔ Aucun conflit.");

  // Fichiers : public/, private/ (chiffrés), legacy-public/, legacy-private/
  const SRC_STORAGE = process.env.SRC_STORAGE, DST_STORAGE = process.env.DST_STORAGE;
  if (SRC_STORAGE && DST_STORAGE) {
    const files = await walk(SRC_STORAGE);
    let copied = 0, already = 0, bad = 0;
    for (const rel of files) {
      const to = join(DST_STORAGE, rel);
      if (await exists(to)) { already++; continue; }
      if (MODE === "reel") {
        await mkdir(join(to, ".."), { recursive: true });
        if (!SAME_KEY && rel.startsWith("private/") && rel.endsWith(".bin")) {
          try { await writeFile(to, resealFile(await readFile(join(SRC_STORAGE, rel)))); } catch { bad++; continue; }
        } else await copyFile(join(SRC_STORAGE, rel), to);
      }
      copied++;
    }
    console.log(`\nFichiers : ${files.length} chez Branshee — ${MODE === "reel" ? "copiés" : "à copier"} : ${copied}, déjà présents : ${already}${bad ? `, illisibles : ${bad}` : ""}`);
  }
  console.log(MODE === "essai" ? "\nESSAI : rien n'a été écrit dans Skydev." : "\nTRANSFERT TERMINÉ.");
  await Promise.all([src.end(), dst.end()]);
  process.exit(conflicts.length && MODE === "reel" ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Échec :", e.code ?? "", e.message);
  await Promise.all([src.end(), dst.end()]).catch(() => {});
  process.exit(1);
});
