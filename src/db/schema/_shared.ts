import { customType } from "drizzle-orm/pg-core";
import { decrypt, encrypt } from "../../lib/field-crypto";
import { timestamp, uuid, text } from "drizzle-orm/pg-core";

/** Identifiant primaire : UUID v4 généré par Postgres. */
export const id = () => uuid("id").primaryKey().defaultRandom();

/** Dates de création / mise à jour, présentes sur presque toutes les tables. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Identifiant MongoDB d'origine (ObjectId en hexadécimal).
 * Sert uniquement à la migration depuis l'ancien Branshee : on peut retrouver
 * et relier chaque ligne à son document source, et relancer le script sans doublons.
 */
export const legacyId = () => text("legacy_id").unique();

/** Plage horaire dans une journée, au format "HH:MM". */
export type TimeRange = { start: string; end: string };

/* ───────── Colonnes chiffrées (données de santé) ─────────
 * Chiffrement AES-256-GCM transparent : écrit chiffré, relu en clair par l'application.
 * Tolérant : une ancienne valeur restée en clair est relue telle quelle (et chiffrée à la prochaine écriture).
 */
const isCipher = (v: string) => v.startsWith("v1.") && v.split(".").length === 4;
const readCipher = (v: string) => {
  if (!isCipher(v)) return v;
  try {
    return decrypt(v) ?? "";
  } catch {
    console.error("[crypto] valeur chiffrée illisible (clé DATA_ENCRYPTION_KEY différente ?)");
    return "";
  }
};

/** Texte libre sensible (motif de consultation, note interne…). */
export const encryptedText = customType<{ data: string; driverData: string }>({
  dataType: () => "text",
  toDriver: (v) => (v === "" ? "" : (encrypt(v) ?? "")),
  fromDriver: (v) => readCipher(v),
});

type Answer = { question: string; answer: string };
/** Réponses au questionnaire : la question reste lisible, la réponse est chiffrée. */
export const encryptedAnswers = customType<{ data: Answer[]; driverData: unknown }>({
  dataType: () => "jsonb",
  toDriver: (rows) => JSON.stringify((rows ?? []).map((r) => ({ question: r.question, answer: r.answer ? (encrypt(r.answer) ?? "") : "" }))),
  fromDriver: (raw) => {
    const rows = (typeof raw === "string" ? JSON.parse(raw) : raw) as Answer[] | null;
    return (rows ?? []).map((r) => ({ question: r.question, answer: typeof r.answer === "string" ? readCipher(r.answer) : "" }));
  },
});
