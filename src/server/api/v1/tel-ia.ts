import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessModules } from "@/db/schema";
import { fail, type Route } from "@/server/api/http";
import { currentContext } from "@/server/context";
import { SKYDEV_ADDONS } from "@/lib/skydev-plans";

/** API mobile de l'app Tél IA (Skydev) : option active ou non, prix et contact (la configuration se fait avec l'équipe Skydev). */

export const telIaRoutes: Route[] = [
  {
    method: "GET",
    path: "/tel-ia",
    handler: async () => {
      const ctx = await currentContext();
      if (!ctx) return fail(409, "no_establishment", "Créez ou rejoignez d'abord une entreprise.");
      const [active] = await db.select({ at: businessModules.activatedAt }).from(businessModules).where(and(eq(businessModules.businessId, ctx.business.id), eq(businessModules.moduleKey, "tel_ia")));
      return {
        active: !!active,
        activatedAt: active?.at.toISOString() ?? null,
        monthlyEuros: SKYDEV_ADDONS.tel_ia.monthly,
        description: SKYDEV_ADDONS.tel_ia.description,
        canSubscribe: ctx.can("billing.manage"),
        phone: "+32477443988",
        phoneLabel: "0477 44 39 88",
      };
    },
  },
];
