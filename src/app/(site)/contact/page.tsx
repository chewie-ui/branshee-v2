import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/site/contact-form";

export const metadata: Metadata = { title: "Contact", description: "Une question sur Branshee ? Écrivez-nous : un humain vous répond, souvent dans la journée.", alternates: { canonical: "/contact" } };

export default function ContactPage() {
  const email = process.env.SUPPORT_EMAIL || "support@branshee.com";
  const whatsapp = (process.env.SUPPORT_WHATSAPP || "32477443988").replace(/\D/g, "");
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Contactez-nous</h1>
        <p className="mt-4 max-w-prose text-lg leading-relaxed text-muted">Une question avant de vous lancer, une idée, un souci ? Un humain de l&apos;équipe vous répond, souvent dans la journée.</p>
        <ul className="mt-8 space-y-4">
          <li className="flex gap-3"><Mail className="mt-0.5 size-5 text-accent" aria-hidden="true" /><span><span className="block font-medium">Email</span><a href={`mailto:${email}`} className="text-muted hover:text-text">{email}</a></span></li>
          {whatsapp ? <li className="flex gap-3"><MessageCircle className="mt-0.5 size-5 text-accent" aria-hidden="true" /><span><span className="block font-medium">WhatsApp</span><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-text">Pour une question rapide</a></span></li> : null}
          <li className="flex gap-3"><LifeBuoy className="mt-0.5 size-5 text-accent" aria-hidden="true" /><span><span className="block font-medium">Déjà inscrit ?</span><span className="text-muted">Écrivez-nous depuis <Link href="/app/aide" className="font-medium text-accent hover:text-accent-hover">Aide et support</Link>, dans votre espace.</span></span></li>
        </ul>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <ContactForm />
      </div>
    </div>
  );
}
