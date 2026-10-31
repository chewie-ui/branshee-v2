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
import { tachesRoutes } from "@/server/api/v1/taches";
import { messagerieRoutes } from "@/server/api/v1/messagerie";
import { planningRoutes } from "@/server/api/v1/planning";
import { congesRoutes } from "@/server/api/v1/conges";
import { paieRoutes } from "@/server/api/v1/paie";
import { depensesRoutes } from "@/server/api/v1/depenses";
import { comptaRoutes } from "@/server/api/v1/compta";
import { documentsRoutes } from "@/server/api/v1/documents";
import { signatureRoutes } from "@/server/api/v1/signature";
import { marketingRoutes } from "@/server/api/v1/marketing";
import { avisRoutes } from "@/server/api/v1/avis";
import { fideliteRoutes } from "@/server/api/v1/fidelite";
import { surMesureRoutes } from "@/server/api/v1/sur-mesure";
import { telIaRoutes } from "@/server/api/v1/tel-ia";
import { siteRoutes } from "@/server/api/v1/site";
import { caisseRoutes } from "@/server/api/v1/caisse";
import { commandesRoutes } from "@/server/api/v1/commandes";
import { ventesRoutes } from "@/server/api/v1/ventes";
import { boutiqueRoutes } from "@/server/api/v1/boutique";

/**
 * Toutes les routes de l'API de l'application (mobile et bureau), préfixe /api/v1.
 * Les routes à chemin fixe passent avant celles à paramètre (« /bookings/slots » avant « /bookings/:id »).
 */
export const routes: Route[] = [...rdvExtraRoutes, ...facturesRoutes, ...tachesRoutes, ...messagerieRoutes, ...planningRoutes, ...congesRoutes, ...paieRoutes, ...depensesRoutes, ...comptaRoutes, ...documentsRoutes, ...signatureRoutes, ...marketingRoutes, ...avisRoutes, ...fideliteRoutes, ...surMesureRoutes, ...telIaRoutes, ...siteRoutes, ...caisseRoutes, ...commandesRoutes, ...ventesRoutes, ...boutiqueRoutes, ...authRoutes, ...accountRoutes, ...establishmentRoutes, ...agendaRoutes, ...clientRoutes, ...catalogRoutes, ...scheduleRoutes, ...groupRoutes, ...teamRoutes, ...billingRoutes];
