import type { Metadata } from "next";
import QRCode from "qrcode";
import { PrintToolbar } from "@/components/invoicing/print-toolbar";
import { requireContext } from "@/server/context";
import { reviewOrigin, reviewSettingsOf } from "@/server/google-reviews";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Affiche avis Google" }, robots: { index: false } };

/** Affiche A5 / A4 pour le comptoir : QR code vers la page d'avis. */
export default async function PrintReviewPoster() {
  const ctx = await requireContext();
  const s = await reviewSettingsOf(ctx.business.id);
  const qr = await QRCode.toDataURL(`${reviewOrigin()}/avis/q/${s.qrToken}`, { margin: 1, width: 640, errorCorrectionLevel: "M" });
  return (
    <div className="min-h-dvh bg-surface-muted py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 15mm; } @media print { html, body { background: #fff; } }`}</style>
      <PrintToolbar />
      <div className="mx-auto flex w-[700px] max-w-full flex-col items-center bg-white p-12 text-center text-[#18181b] shadow-sm print:w-full print:shadow-none">
        <p className="text-lg text-[#52525b]">{ctx.business.name}</p>
        <p className="mt-2 text-4xl font-semibold">Vous avez aimé ?</p>
        <p className="mt-2 text-xl">Laissez-nous un avis sur Google</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="" className="my-8 size-72" />
        <p className="text-lg font-medium">Scannez avec l&apos;appareil photo de votre téléphone</p>
        <p className="mt-1 text-[#52525b]">Une minute, sans application. Merci !</p>
        {!s.googleUrl ? <p className="mt-6 rounded bg-[#fef3c7] px-3 py-2 text-sm text-[#92400e] print:hidden">Attention : ajoutez d&apos;abord le lien de votre fiche Google dans les réglages, sinon le QR code n&apos;envoie pas vers Google.</p> : null}
      </div>
    </div>
  );
}
