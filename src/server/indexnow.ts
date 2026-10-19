import "server-only";
import { isStaging } from "@/lib/staging";

/**
 * IndexNow (Bing, Yandex… — pas Google) : signale une URL nouvelle ou modifiée. Silencieux et non bloquant.
 * La clé est publique par nature (servie dans /public/<clé>.txt) ; elle reste celle de l'ancien Branshee.
 */
const KEY = () => process.env.INDEXNOW_KEY || "b7f3a91c4e2d84605fa1c9d3e8b26074";

export async function indexNow(paths: string[]) {
  if (isStaging()) return;
  if (process.env.NODE_ENV !== "production") return;
  const base = (process.env.APP_URL ?? "https://branshee.com").replace(/\/$/, "");
  const host = new URL(base).host;
  const urlList = paths.map((p) => (p.startsWith("http") ? p : base + p)).filter((u) => u.startsWith(base));
  if (!urlList.length) return;
  await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: KEY(), keyLocation: `${base}/${KEY()}.txt`, urlList }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}
