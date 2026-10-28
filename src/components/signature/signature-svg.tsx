/** Affiche un tracé de signature enregistré (chemin SVG dans un cadre 400 × 160). */
export function SignatureSvg({ path, className }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 400 160" className={className} role="img" aria-label="Signature">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
