import "server-only";
import type { Route } from "@/server/api/http";
import { authRoutes } from "@/server/api/v1/auth";
import { accountRoutes } from "@/server/api/v1/account";
import { establishmentRoutes } from "@/server/api/v1/establishments";
import { agendaRoutes } from "@/server/api/v1/agenda";
import { clientRoutes } from "@/server/api/v1/clients";
import { catalogRoutes } from "@/server/api/v1/catalog";
import { scheduleRoutes } from "@/server/api/v1/schedule";
import { groupRoutes } from "@/server/api/v1/group";
import { teamRoutes } from "@/server/api/v1/team";
import { billingRoutes } from "@/server/api/v1/billing";
import { rdvExtraRoutes } from "@/server/api/v1/rdv-extra";
import { facturesRoutes } from "@/server/api/v1/factures";

/**
 * Toutes les routes de l'API de l'application (mobile et bureau), préfixe /api/v1.
 * Les routes à chemin fixe passent avant celles à paramètre (« /bookings/slots » avant « /bookings/:id »).
 */
export const routes: Route[] = [...rdvExtraRoutes, ...facturesRoutes, ...authRoutes, ...accountRoutes, ...establishmentRoutes, ...agendaRoutes, ...clientRoutes, ...catalogRoutes, ...scheduleRoutes, ...groupRoutes, ...teamRoutes, ...billingRoutes];
