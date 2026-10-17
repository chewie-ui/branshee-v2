import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { ClientNav } from "@/components/client/client-nav";
import { logout } from "@/server/actions/auth";
import { requireClient, isPro } from "@/server/client-account";

export const dynamic = "force-dynamic";

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const user = await requireClient();
  const pro = await isPro(user.id);
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/espace-client" aria-label="Espace client"><Brand /></Link>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {pro ? <Link href="/app" className="font-medium text-accent hover:text-accent-hover">Espace pro</Link> : null}
            <span className="hidden text-muted sm:inline">{user.fullName}</span>
            <form action={logout}>
              <button type="submit" className="font-medium text-muted hover:text-text">Se déconnecter</button>
            </form>
          </div>
        </div>
        <ClientNav />
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
