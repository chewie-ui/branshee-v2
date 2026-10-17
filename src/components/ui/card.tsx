import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ children, className, ...props }: { children: ReactNode; className?: string } & Omit<ComponentProps<"section">, "children" | "className">) {
  return (
    <section className={cn("rounded-xl border border-border bg-surface", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
