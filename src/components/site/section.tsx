import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({ id, children, className, muted }: { id?: string; children: ReactNode; className?: string; muted?: boolean }) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-16 sm:py-24", muted && "bg-surface", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  );
}

export function SectionTitle({ pill, title, sub, center = true }: { pill?: string; title: ReactNode; sub?: string; center?: boolean }) {
  return (
    <div className={cn("mb-10 max-w-2xl sm:mb-14", center && "mx-auto text-center")}>
      {pill ? <p className="text-sm font-semibold text-accent">{pill}</p> : null}
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {sub ? <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{sub}</p> : null}
    </div>
  );
}
