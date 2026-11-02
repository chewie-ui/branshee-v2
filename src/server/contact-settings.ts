import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { contactModeOf, type ContactMode } from "@/lib/contact-mode";

export type ContactSettings = { id: string; name: string; phone: string | null; mode: ContactMode; note: string | null };

const cols = { id: businesses.id, name: businesses.name, phone: businesses.phone, mode: businesses.contactMode, note: businesses.contactNote };

/** Réglage « comment vous joindre » d'une entreprise (par identifiant). Sans téléphone, « Appel uniquement » retombe sur « Rappelez-moi ». */
export async function contactSettingsById(businessId: string): Promise<ContactSettings | null> {
  const [b] = await db.select(cols).from(businesses).where(and(eq(businesses.id, businessId), isNull(businesses.deletedAt)));
  return b ? normalize(b) : null;
}

export async function contactSettingsBySlug(slug: string): Promise<ContactSettings | null> {
  const [b] = await db.select(cols).from(businesses).where(and(eq(businesses.slug, slug), isNull(businesses.deletedAt)));
  return b ? normalize(b) : null;
}

function normalize(b: { id: string; name: string; phone: string | null; mode: string; note: string | null }): ContactSettings {
  const mode = contactModeOf(b.mode);
  return { id: b.id, name: b.name, phone: b.phone, note: b.note, mode: mode === "phone" && !b.phone ? "callback" : mode };
}
