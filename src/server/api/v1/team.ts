import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { grades, members, users } from "@/db/schema";
import { addMember, deleteGrade, removeMember, saveGrade, updateMember } from "@/server/actions/team";
import { decideJoinRequest } from "@/server/actions/memberships";
import { collaboratorUsage } from "@/server/plan";
import { PERMISSIONS, type Permissions } from "@/lib/permissions";
import { bool, ensureOk, fail, formData, has, invalid, str, type ApiRequest, type Route } from "@/server/api/http";
import { needCtx, PLACEHOLDER_AVATAR } from "@/server/api/v1/shared";
import type { AppContext } from "@/server/context";

const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");
const isRedirect = (e: unknown) => String((e as { digest?: string })?.digest ?? "").startsWith("NEXT_REDIRECT");

/** Appelle une action du site qui redirige en cas de succès. */
async function run<T extends { error?: string; fieldErrors?: Record<string, string> } | { ok: boolean; error?: string } | undefined>(fn: () => Promise<T>) {
  try {
    const res = await fn();
    const r = res as { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | undefined;
    if (r?.error || r?.ok === false) return invalid(r.fieldErrors ? (Object.values(r.fieldErrors)[0] ?? r.error ?? "Action impossible.") : (r.error ?? "Action impossible."));
  } catch (e) {
    if (!isRedirect(e)) throw e;
  }
}

async function rows(ctx: AppContext) {
  return db
    .select({ m: members, gradeName: grades.name, email: users.email, avatar: users.avatarUrl })
    .from(members)
    .leftJoin(grades, eq(grades.id, members.gradeId))
    .leftJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.businessId, ctx.business.id), eq(members.isOwner, false), inArray(members.status, ["active", "invited", "requested"])))
    .orderBy(asc(members.createdAt));
}

type Row = Awaited<ReturnType<typeof rows>>[number];
const collaborator = (r: Row) => ({
  id: r.m.id,
  userId: r.m.userId ?? "",
  fullName: r.m.displayName,
  email: r.email ?? r.m.inviteEmail ?? "",
  profilePicture: r.m.photoUrl ?? r.avatar ?? PLACEHOLDER_AVATAR,
  gradeId: r.m.gradeId ?? "",
  gradeName: r.gradeName ?? "",
  isActive: r.m.isActive,
  isEmployee: r.m.isBookable,
  status: r.m.status === "active" ? ("accepted" as const) : ("pending" as const),
  since: iso(r.m.joinedAt ?? r.m.createdAt),
});

async function gradeList(ctx: AppContext) {
  const list = await db.select().from(grades).where(eq(grades.businessId, ctx.business.id)).orderBy(asc(grades.createdAt));
  const counts = list.length ? await db.select({ id: members.gradeId, n: count() }).from(members).where(and(eq(members.businessId, ctx.business.id), inArray(members.gradeId, list.map((g) => g.id)))).groupBy(members.gradeId) : [];
  return list.map((g) => ({ id: g.id, name: g.name, isBuiltIn: g.isBuiltIn, memberCount: counts.find((c) => c.id === g.id)?.n ?? 0, permissions: g.permissions as unknown as Record<string, Record<string, boolean>>, createdAt: g.createdAt.toISOString() }));
}

async function listTeam() {
  const ctx = await needCtx("team.view");
  const all = await rows(ctx);
  const seats = await collaboratorUsage(ctx.business.id);
  const g = await gradeList(ctx);
  const limit = Number.isFinite(seats.max) ? seats.max : null;
  return {
    collaborators: all.filter((r) => r.m.status === "active").map(collaborator),
    invitations: all.filter((r) => r.m.status === "invited").map((r) => ({ id: r.m.id, fullName: r.m.displayName, email: r.email ?? r.m.inviteEmail ?? "", profilePicture: r.avatar ?? PLACEHOLDER_AVATAR, gradeName: r.gradeName ?? "", invitedAt: iso(r.m.createdAt) })),
    requests: all.filter((r) => r.m.status === "requested").map((r) => ({ id: r.m.id, fullName: r.m.displayName, email: r.email ?? "", profilePicture: r.avatar ?? PLACEHOLDER_AVATAR, requestedAt: iso(r.m.createdAt) })),
    grades: g.map(({ permissions, createdAt, ...x }) => (void permissions, void createdAt, x)),
    limit,
    used: seats.used,
    atLimit: seats.used >= seats.max,
    canManage: ctx.can("team.manage"),
    canAssignGrade: ctx.can("team.manage"),
  };
}

async function member(ctx: AppContext, id: string) {
  if (!uuid(id)) return fail(404, "not_found", "Collaborateur introuvable.");
  const [r] = (await rows(ctx)).filter((x) => x.m.id === id);
  return r ?? fail(404, "not_found", "Collaborateur introuvable.");
}

async function invite(r: ApiRequest) {
  await needCtx("team.manage");
  const email = str(r.body.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid("Adresse email invalide.", { field: "email" });
  const [u] = await db.select({ name: users.fullName }).from(users).where(sql`lower(${users.email}) = ${email}`);
  const fullName = u?.name ?? email.split("@")[0]!;
  const gradeId = uuid(str(r.body.gradeId, 40)) ? str(r.body.gradeId, 40) : "";
  await run(() => addMember(undefined, formData({ displayName: fullName.length >= 2 ? fullName : email, email, roleLabel: "", gradeId, isBookable: true })));
  const [g] = gradeId ? await db.select({ name: grades.name }).from(grades).where(eq(grades.id, gradeId)) : [];
  return { ok: true, invitation: { fullName, email, gradeName: g?.name ?? "" } };
}

async function update(r: ApiRequest) {
  const ctx = await needCtx("team.manage");
  const cur = await member(ctx, r.params.id!);
  const m = cur.m;
  const gradeId = has(r.body, "gradeId") ? (uuid(str(r.body.gradeId, 40)) ? str(r.body.gradeId, 40) : "") : (m.gradeId ?? "");
  ensureOk(
    await updateMember(
      m.id,
      undefined,
      formData({
        displayName: m.displayName,
        roleLabel: m.roleLabel ?? "",
        bio: m.bio ?? "",
        showRole: m.showRole,
        gradeId,
        isBookable: m.isBookable,
        isActive: has(r.body, "isActive") ? bool(r.body.isActive) : m.isActive,
        timeOff: m.canManageOwnTimeOff == null ? "inherit" : m.canManageOwnTimeOff ? "yes" : "no",
        customInfo: m.customInfo.map((c) => `${c.label}: ${c.value}`).join("\n"),
      }),
    ) ?? { ok: true },
  );
  return { ok: true, collaborator: collaborator(await member(ctx, m.id)) };
}

/* ── Grades ── */

const ICONS: Record<string, string> = { appointments: "calendar-outline", customers: "people-outline", services: "pricetags-outline", groupSessions: "people-circle-outline", availability: "time-outline", forms: "document-text-outline", customization: "color-palette-outline", settings: "settings-outline", team: "person-add-outline", grades: "ribbon-outline", logs: "list-outline", billing: "card-outline", business: "business-outline" };

function schema() {
  return {
    zones: Object.entries(PERMISSIONS).map(([zone, def]) => ({ zone, label: def.label, description: "", icon: ICONS[zone] ?? "ellipse-outline", keys: Object.entries(def.actions).map(([key, label]) => ({ key, label })) })),
    groups: [
      { title: "Au quotidien", description: "Agenda, clients et cours.", zones: ["appointments", "customers", "groupSessions", "availability"] },
      { title: "Votre offre", description: "Prestations, formulaire et page de réservation.", zones: ["services", "forms", "customization"] },
      { title: "Gestion", description: "Équipe, réglages et abonnement.", zones: ["team", "grades", "logs", "settings", "billing", "business"] },
    ],
  };
}

function permissionFields(matrix: Record<string, Record<string, boolean>>) {
  const fields: Record<string, boolean> = {};
  for (const [domain, def] of Object.entries(PERMISSIONS)) for (const action of Object.keys(def.actions)) fields[`${domain}.${action}`] = !!matrix?.[domain]?.[action];
  return fields;
}

async function saveG(r: ApiRequest, id: string | null) {
  const ctx = await needCtx("grades.manage");
  let current: { name: string; permissions: Permissions } | null = null;
  if (id) {
    if (!uuid(id)) return fail(404, "not_found", "Grade introuvable.");
    [current] = await db.select({ name: grades.name, permissions: grades.permissions }).from(grades).where(and(eq(grades.id, id), eq(grades.businessId, ctx.business.id)));
    if (!current) return fail(404, "not_found", "Grade introuvable.");
  }
  const name = has(r.body, "name") ? str(r.body.name, 40) : (current?.name ?? "");
  const matrix = (has(r.body, "permissions") && typeof r.body.permissions === "object" ? r.body.permissions : current?.permissions ?? {}) as Record<string, Record<string, boolean>>;
  await run(() => saveGrade(id, undefined, formData({ name, ...permissionFields(matrix) })));
  const list = await gradeList(ctx);
  const grade = id ? list.find((g) => g.id === id) : list.find((g) => g.name === name);
  return { ok: true, grade };
}

async function removeG(r: ApiRequest) {
  const ctx = await needCtx("grades.manage");
  const id = r.params.gradeId!;
  if (!uuid(id)) return fail(404, "not_found", "Grade introuvable.");
  const [{ n }] = await db.select({ n: count() }).from(members).where(and(eq(members.businessId, ctx.business.id), eq(members.gradeId, id)));
  const target = str(r.body.reassignToGradeId, 40);
  let reassigned = 0;
  if (n > 0) {
    if (!uuid(target) || target === id) return fail(409, "grade_in_use", `Ce grade est attribué à ${n} personne${n > 1 ? "s" : ""}. Choisissez le grade à leur donner.`, { count: n });
    const [g] = await db.select({ id: grades.id }).from(grades).where(and(eq(grades.id, target), eq(grades.businessId, ctx.business.id)));
    if (!g) return invalid("Grade de remplacement introuvable.");
    reassigned = (await db.update(members).set({ gradeId: target }).where(and(eq(members.businessId, ctx.business.id), eq(members.gradeId, id))).returning({ id: members.id })).length;
  }
  await run(() => deleteGrade(id));
  return { ok: true, id, reassigned };
}

export const teamRoutes: Route[] = [
  { method: "GET", path: "/collaborators", handler: listTeam },
  { method: "POST", path: "/collaborators", handler: invite },
  { method: "PATCH", path: "/collaborators/:id", handler: update },
  {
    method: "DELETE",
    path: "/collaborators/:id",
    handler: async (r) => {
      const ctx = await needCtx("team.manage");
      const cur = await member(ctx, r.params.id!);
      await run(() => removeMember(cur.m.id));
      return { ok: true, id: cur.m.id };
    },
  },
  {
    method: "PATCH",
    path: "/collaborators/requests/:id",
    handler: async (r) => {
      const ctx = await needCtx("team.manage");
      const id = r.params.id!;
      if (!uuid(id)) return fail(404, "not_found", "Demande introuvable.");
      const accept = r.body.decision === "accepted";
      if (!accept && r.body.decision !== "rejected") return invalid("Décision inconnue.");
      ensureOk(await decideJoinRequest(id, accept));
      const after = accept ? (await rows(ctx)).find((x) => x.m.id === id) : null;
      return { ok: true, id, decision: accept ? "accepted" : "rejected", collaborator: after ? collaborator(after) : null };
    },
  },
  { method: "GET", path: "/grades/schema", handler: async () => (await needCtx("grades.view"), schema()) },
  {
    method: "GET",
    path: "/grades",
    handler: async () => {
      const ctx = await needCtx("grades.view");
      return { grades: await gradeList(ctx), canManage: ctx.can("grades.manage") };
    },
  },
  { method: "POST", path: "/grades", handler: (r) => saveG(r, null) },
  { method: "PATCH", path: "/grades/:gradeId", handler: (r) => saveG(r, r.params.gradeId!) },
  { method: "DELETE", path: "/grades/:gradeId", handler: removeG },
];
