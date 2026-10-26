import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { currentBrand } from "@/server/brand";

/** Le titre de l'onglet suit la marque de l'adresse visitée (« … · Skydev » ou « … · Branshee »). */
export async function generateMetadata(): Promise<Metadata> {
  const { name } = await currentBrand();
  return { title: { default: name, template: `%s · ${name}` } };
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <Brand brand={(await currentBrand()).id} />
      <main className="mt-8 w-full max-w-sm">{children}</main>
    </div>
  );
}
