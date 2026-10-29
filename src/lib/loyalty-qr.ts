import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * QR code « tampon » affiché par le pro : il change toutes les 30 secondes et reste valable 5 minutes
 * (le temps que le client remplisse son nom la première fois). Une photo du QR ne sert donc pas plus tard.
 */
export const QR_STEP_MS = 30_000;
export const QR_VALID_STEPS = 10;

export const qrWindow = (now = Date.now()) => Math.floor(now / QR_STEP_MS);

export function qrSign(key: string, businessId: string, window: number) {
  return createHmac("sha256", key).update(`loyalty-qr.${businessId}.${window}`).digest("base64url").slice(0, 22);
}

export function qrVerify(key: string, businessId: string, window: number, sig: string, now = Date.now()) {
  const cur = qrWindow(now);
  if (!Number.isInteger(window) || window > cur || window < cur - QR_VALID_STEPS) return false;
  const a = Buffer.from(qrSign(key, businessId, window));
  const b = Buffer.from(String(sig));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Tampon automatique ou scanné : un seul par jour et par client (jour du fuseau de l'entreprise). */
export const sameDay = (a: Date | null, b: Date, timeZone: string) => {
  if (!a) return false;
  const f = new Intl.DateTimeFormat("en-CA", { timeZone });
  return f.format(a) === f.format(b);
};
