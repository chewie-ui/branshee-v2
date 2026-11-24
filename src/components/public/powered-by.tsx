/** « Réservation en ligne par Skydev » en bas des pages publiques des pros : lien (avec parrainage du pro) vers Skydev. */
export function PoweredBy({ by, label = "Propulsé par", className = "" }: { by?: { name: string; url: string }; label?: string; className?: string }) {
  if (!by) return null;
  return (
    <p className={`text-center text-xs text-muted ${className}`}>
      {label}{" "}
      <a href={by.url} className="font-medium text-text underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {by.name}
      </a>
    </p>
  );
}
