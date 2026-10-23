import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activityLogs, businesses, members } from "@/db/schema";
import { acceptInvitation, cancelJoinRequest, declineInvitation, requestJoin, searchBusinesses, setBusinessPausedByOwner } from "@/server/actions/memberships";
import { createBusinessAction } from "@/server/actions/business";
import { listMemberships } from "@/server/memberships";
import { effectivePlan, canUserCreateBusiness } from "@/server/plan";
import { deletePublicImage } from "@/server/storage";
import { apiAuth } from "@/server/api/als";
import { bool, ensureOk, fail, formData, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { APP_PLAN, needCtx } from "@/server/api/v1/shared";
import { readPhoto } from "@/server/api/v1/account";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const uuidOk = (v: string) => /^[0-9a-f-]{36}$/i.test(v) || fail(404, "not_found", "Établissement introuvable.");

async function list(r: ApiRequest) {
  const userId = r.auth!.userId;
  const rows = await listMemberships(userId);
  const ids = rows.map((m) => m.business.id);
  const extra = ids.length ? await db.select({ id: businesses.id, createdAt: businesses.createdAt }).from(businesses).where(inArray(businesses.id, ids)) : [];
  const created = new Map(extra.map((e) => [e.id, e.createdAt]));
  const base = async (m: (typeof rows)[number]) => ({
    id: m.business.id,
    name: m.business.name,
    businessType: m.business.businessType ?? "",
    photo: m.business.photoUrl ?? "",
    isPaused: !!m.business.pausedAt,
    createdAt: iso(created.get(m.business.id)),
    isOwner: m.isOwner,
    role: m.isOwner ? "Propriétaire" : (m.gradeName ?? "Collaborateur"),
    isActive: m.status === "active",
    plan: APP_PLAN[(await effectivePlan(m.business.id)).plan],
    membershipId: m.memberId,
  });
  const all = await Promise.all(rows.map(async (m) => ({ m, dto: await base(m) })));
  const can = await canUserCreateBusiness(userId);
  return {
    owned: all.filter((x) => x.m.isOwner && x.m.status === "active").map((x) => x.dto),
    memberOf: all.filter((x) => !x.m.isOwner && x.m.status === "active").map((x) => x.dto),
    invitations: all.filter((x) => x.m.status === "invited").map((x) => ({ ...x.dto, status: "pending" as const })),
    requests: all.filter((x) => x.m.status === "requested").map((x) => ({ ...x.dto, status: "pending" as const })),
    canCreate: {
      canCreate: can.ok,
      reason: "",
      freeCount: 0,
      businessCount: all.filter((x) => x.m.isOwner && x.dto.plan === "business").length,
      allowedFree: 0,
    },
  };
}

async function create(r: ApiRequest) {
  const name = str(r.body.name, 120);
  if (name.length < 2) return invalid("Indiquez le nom de l'établissement.", { field: "name" });
  try {
    const res = await createBusinessAction(undefined, formData({ name, businessType: str(r.body.businessType, 120), city: str(r.body.city, 120) }));
    if (res?.error || res?.fieldErrors) return invalid(res.error ?? Object.values(res.fieldErrors ?? {})[0] ?? "Création impossible.");
  } catch (e) {
    if (!String((e as { digest?: string })?.digest ?? "").startsWith("NEXT_REDIRECT")) throw e;
  }
  const [latest] = await db.select().from(businesses).where(and(eq(businesses.ownerId, r.auth!.userId), isNull(businesses.deletedAt))).orderBy(desc(businesses.createdAt)).limit(1);
  if (!latest) return fail(500, "server_error", "Création impossible.");
  return { establishment: { id: latest.id, name: latest.name, businessType: latest.businessType ?? "", photo: latest.photoUrl ?? "", isPaused: false, createdAt: iso(latest.createdAt), isOwner: true, role: "Propriétaire", isActive: true, plan: "basic" } };
}

async function search(r: ApiRequest) {
  const q = str(r.query.get("q"), 60);
  const found = q.length >= 2 ? await searchBusinesses(q) : [];
  const ids = found.map((f) => f.id);
  const counts = ids.length ? await db.select({ id: members.businessId, n: count() }).from(members).where(and(inArray(members.businessId, ids), eq(members.status, "active"), eq(members.isOwner, false))).groupBy(members.businessId) : [];
  const meta = ids.length ? await db.select({ id: businesses.id, pausedAt: businesses.pausedAt, createdAt: businesses.createdAt }).from(businesses).where(inArray(businesses.id, ids)) : [];
  const list = found
    .map((f) => {
      const m = meta.find((x) => x.id === f.id);
      return { id: f.id, name: f.name, businessType: f.businessType ?? "", photo: f.photoUrl ?? "", isPaused: !!m?.pausedAt, createdAt: iso(m?.createdAt), city: f.city ?? "", collaboratorsCount: counts.find((c) => c.id === f.id)?.n ?? 0 };
    })
    .filter((e) => !e.isPaused);
  return { query: q, suggestions: q.length < 2, count: list.length, establishments: list };
}

async function myMembership(userId: string, businessId: string) {
  const [m] = await db.select().from(members).where(and(eq(members.businessId, businessId), eq(members.userId, userId)));
  return m ?? null;
}

/** Réglages d'un établissement précis (celui de l'URL, pas forcément l'actif). */
function onBusiness<T>(r: ApiRequest, fn: () => Promise<T>) {
  const id = r.params.id!;
  uuidOk(id);
  return apiAuth.run({ userId: r.auth!.userId, sessionId: r.auth!.sessionId, businessId: id }, async () => {
    const ctx = await needCtx();
    if (ctx.business.id !== id) return fail(403, "forbidden", "Vous ne faites pas partie de cet établissement.");
    if (!ctx.can("business.manage")) return fail(403, "forbidden", "Votre grade ne permet pas de modifier cet établissement.");
    return fn();
  });
}

async function settingsDto(id: string, userId: string) {
  const [b] = await db.select().from(businesses).where(eq(businesses.id, id));
  if (!b) return fail(404, "not_found", "Établissement introuvable.");
  const isOwner = b.ownerId === userId;
  return {
    establishment: { id: b.id, name: b.name, businessType: b.businessType ?? "", photo: b.photoUrl ?? "", hasPhoto: !!b.photoUrl, isPaused: !!b.pausedAt, plan: APP_PLAN[(await effectivePlan(b.id)).plan], isOwner, createdAt: iso(b.createdAt) },
    // En v2, description et coordonnées appartiennent à l'établissement (plus au compte du propriétaire).
    contact: { scope: "account" as const, editable: true, description: b.description ?? "", emailPro: b.email ?? "", phonePro: b.phone ?? "", website: b.website ?? "", address: b.address ?? "", city: b.city ?? "", zip: b.postalCode ?? "", country: b.country ?? "" },
  };
}

async function updateSettings(r: ApiRequest) {
  return onBusiness(r, async () => {
    const id = r.params.id!;
    const b = r.body;
    const set: Partial<typeof businesses.$inferInsert> = {};
    if (has(b, "name")) {
      const name = str(b.name, 120);
      if (name.length < 2) return invalid("Nom trop court.", { field: "name" });
      set.name = name;
    }
    const text = (k: string, col: keyof typeof set, max = 300) => {
      if (has(b, k)) (set as Record<string, unknown>)[col] = str(b[k], max) || null;
    };
    text("businessType", "businessType", 120);
    text("description", "description", 2000);
    text("phonePro", "phone", 40);
    text("website", "website", 300);
    text("address", "address");
    text("city", "city", 120);
    text("zip", "postalCode", 20);
    text("country", "country", 80);
    if (has(b, "emailPro")) {
      const e = str(b.emailPro, 200).toLowerCase();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return invalid("Adresse email invalide.", { field: "emailPro" });
      set.email = e || null;
    }
    if (set.website && !/^https?:\/\//i.test(set.website)) set.website = `https://${set.website}`;
    if (Object.keys(set).length) {
      await db.update(businesses).set(set).where(eq(businesses.id, id));
      const ctx = await needCtx();
      await db.insert(activityLogs).values({ businessId: id, userId: ctx.user.id, actorName: ctx.user.name, action: "settings.business", description: "Infos de l'établissement modifiées (application)" });
    }
    if (has(b, "isPaused")) ensureOk(await setBusinessPausedByOwner(id, bool(b.isPaused)));
    return { ok: true, ...(await settingsDto(id, r.auth!.userId)) };
  });
}

export const establishmentRoutes: Route[] = [
  { method: "GET", path: "/establishments", handler: list },
  { method: "POST", path: "/establishments", handler: create },
  { method: "GET", path: "/establishments/search", handler: search },
  {
    method: "POST",
    path: "/establishments/:id/join",
    handler: async (r) => {
      uuidOk(r.params.id!);
      ensureOk(await requestJoin(r.params.id!));
      const [b] = await db.select().from(businesses).where(eq(businesses.id, r.params.id!));
      return { ok: true, status: "pending", establishment: { id: b!.id, name: b!.name, businessType: b!.businessType ?? "", photo: b!.photoUrl ?? "", isPaused: !!b!.pausedAt, createdAt: iso(b!.createdAt), status: "pending" } };
    },
  },
  {
    method: "DELETE",
    path: "/establishments/:id/join",
    handler: async (r) => {
      uuidOk(r.params.id!);
      const m = await myMembership(r.auth!.userId, r.params.id!);
      if (m?.status === "requested") ensureOk(await cancelJoinRequest(m.id));
      return { ok: true, id: r.params.id };
    },
  },
  {
    method: "PATCH",
    path: "/establishments/invitations/:membershipId",
    handler: async (r) => {
      const id = r.params.membershipId!;
      uuidOk(id);
      const accept = r.body.action === "accept";
      if (!accept && r.body.action !== "reject") return invalid("Action inconnue.");
      const [m] = await db.select({ businessId: members.businessId }).from(members).where(eq(members.id, id));
      ensureOk(accept ? await acceptInvitation(id) : await declineInvitation(id));
      return { ok: true, membershipId: id, status: accept ? "accepted" : "rejected", companyId: m?.businessId ?? "" };
    },
  },
  { method: "GET", path: "/establishments/:id/settings", handler: (r) => onBusiness(r, () => settingsDto(r.params.id!, r.auth!.userId)) },
  { method: "PATCH", path: "/establishments/:id/settings", handler: updateSettings },
  {
    method: "POST",
    path: "/establishments/:id/photo",
    handler: (r) =>
      onBusiness(r, async () => {
        const url = await readPhoto(r);
        const [b] = await db.select({ photo: businesses.photoUrl }).from(businesses).where(eq(businesses.id, r.params.id!));
        await db.update(businesses).set({ photoUrl: url }).where(eq(businesses.id, r.params.id!));
        await deletePublicImage(b?.photo);
        return { ok: true, photo: url };
      }),
  },
  {
    method: "DELETE",
    path: "/establishments/:id/photo",
    handler: (r) =>
      onBusiness(r, async () => {
        const [b] = await db.select({ photo: businesses.photoUrl }).from(businesses).where(eq(businesses.id, r.params.id!));
        await db.update(businesses).set({ photoUrl: null }).where(eq(businesses.id, r.params.id!));
        await deletePublicImage(b?.photo);
        return { ok: true, photo: "" };
      }),
  },
];
