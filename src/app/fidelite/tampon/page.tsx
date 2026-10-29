import type { Metadata } from "next";
import { ScanStamp } from "@/components/loyalty/scan-stamp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Mon tampon de fidélité" }, robots: { index: false, follow: false } };

/** Page ouverte par le QR code du pro : le tampon est donné par une action (jamais au simple chargement). */
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ b?: string; w?: string; s?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <ScanStamp b={String(sp.b ?? "").slice(0, 40)} w={Number(sp.w) || 0} s={String(sp.s ?? "").slice(0, 40)} />
    </div>
  );
}
