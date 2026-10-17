import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 select-none " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover active:bg-accent-hover/90 shadow-sm",
  secondary: "bg-surface text-text border border-border-strong hover:bg-surface-muted active:bg-border",
  ghost: "text-muted hover:bg-surface-muted hover:text-text active:bg-border",
  danger: "bg-danger text-white hover:bg-red-700 active:bg-red-800",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; loading?: boolean };

export function Button({ variant = "primary", size = "md", icon, loading, className, children, disabled, ...props }: Common & ComponentProps<"button">) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "primary", size = "md", icon, className, children, ...props }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
