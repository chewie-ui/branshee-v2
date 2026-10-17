import { NextResponse, type NextRequest } from "next/server";
import { requireContext } from "@/server/context";
import { stripe } from "@/server/payments";
import { completeSmsTopup } from "@/server/sms";

const appUrl = () => (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const ctx = await requireContext("billing.manage");
  const id = req.nextUrl.searchParams.get("session_id") ?? "";
  const s = stripe();
  const session = s && /^cs_\w+$/.test(id) ? await s.checkout.sessions.retrieve(id).catch(() => null) : null;
  const ok = !!session && session.metadata?.userId === ctx.user.id && (await completeSmsTopup(session));
  return NextResponse.redirect(`${appUrl()}/app/reglages/sms?recharge=${ok ? "ok" : "erreur"}`);
}
