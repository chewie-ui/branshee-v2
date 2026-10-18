import Link from "next/link";
import { Compass } from "lucide-react";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16 text-center">
      <Link href="/" aria-label="Branshee, accueil"><Brand /></Link>
      <Compass className="mt-10 size-10 text-muted" aria-hidden="true" />
      <p className="mt-4 text-sm font-semibold text-accent">Erreur 404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Cette page n&apos;existe pas</h1>
      <p className="mt-2 max-w-md text-sm text-muted">Le lien est peut-être incomplet, ou la page a été déplacée. Vérifiez l&apos;adresse ou repartez de l&apos;une de ces pages :</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover">Accueil</Link>
        <Link href="/annuaire" className="inline-flex h-10 items-center rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted">Trouver un professionnel</Link>
        <Link href="/app" className="inline-flex h-10 items-center rounded-lg border border-border-strong px-4 text-sm font-medium hover:bg-surface-muted">Mon espace</Link>
      </div>
    </div>
  );
}
