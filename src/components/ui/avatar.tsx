import { cn } from "@/lib/cn";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({ name, src, size = "md", className }: { name: string; src?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-12 text-sm" }[size];
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars externes de tailles variées
    return <img src={src} alt="" className={cn("shrink-0 rounded-full object-cover", dims, className)} />;
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-soft-foreground", dims, className)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
