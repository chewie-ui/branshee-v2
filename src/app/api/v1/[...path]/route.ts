import { dispatch } from "@/server/api/http";
import { routes } from "@/server/api/v1";

/**
 * API de l'application Branshee (mobile et bureau). Même contrat que l'ancien `/api/v1`,
 * pour que l'application déjà publiée continue de fonctionner sur la v2.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };
const handle = async (req: Request, { params }: Ctx) => dispatch(routes, req, (await params).path);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
