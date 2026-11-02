import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarDays, Check, Fuel, Gauge, Phone, ShieldCheck, Zap } from "lucide-react";
import { PublicVehicleCard } from "@/components/vehicles/public-card";
import { VehicleShell } from "@/components/vehicles/public-shell";
import { VehicleGallery } from "@/components/vehicles/vehicle-gallery";
import { VehicleInquiry } from "@/components/vehicles/vehicle-inquiry";
import { FUELS, GEARBOXES, formatKm, formatPower, formatPrice, formatRegistration, publicSpecs, registrationYear, vehicleFullTitle } from "@/lib/vehicles";
import { siteUrl } from "@/server/site";
import { publicVehicle } from "@/server/vehicles";
import { contactSettingsById } from "@/server/contact-settings";
import { ContactBlock } from "@/components/contact/contact-block";

export const dynamic = "force-dynamic";
type P = Promise<{ slug: string; vehicle: string }>;
const ok = (slug: string, vehicle: string) => /^[a-z0-9-]{1,80}$/.test(slug) && /^[a-z0-9-]{1,100}$/.test(vehicle);

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { slug, vehicle } = await params;
  if (!ok(slug, vehicle)) return {};
  const d = await publicVehicle(slug, vehicle);
  if (!d) return {};
  const v = d.vehicle;
  const facts = [registrationYear(v.firstRegistration), formatKm(v.mileageKm), v.fuel ? (FUELS as Record<string, string>)[v.fuel] : null].filter(Boolean).join(", ");
  return {
    title: { absolute: `${vehicleFullTitle(v)}${facts ? ` (${facts})` : ""} · ${d.business.name}` },
    description: `${vehicleFullTitle(v)} ${v.status === "sold" ? "vendue" : `à ${formatPrice(v.priceCents)}`} chez ${d.business.name}${d.business.city ? ` à ${d.business.city}` : ""}. ${facts}.`.slice(0, 300),
    alternates: { canonical: `/vehicules/${slug}/${vehicle}` },
    openGraph: v.photos[0] ? { images: [{ url: v.photos[0] }] } : undefined,
    robots: v.status === "sold" ? { index: false, follow: true } : undefined,
  };
}

/** Fiche publique d'un véhicule : galerie, prix, chiffres clés, demande d'info, caractéristiques, équipements. */
export default async function VehicleDetail({ params }: { params: P }) {
  const { slug, vehicle } = await params;
  if (!ok(slug, vehicle)) notFound();
  const d = await publicVehicle(slug, vehicle);
  if (!d) notFound();
  const { business: b, vehicle: v } = d;
  const title = vehicleFullTitle(v);
  const base = `/vehicules/${slug}`;
  const sold = v.status === "sold";
  const cs = await contactSettingsById(b.id);
  const mode = cs?.mode ?? "form";
  const key = [
    { icon: CalendarDays, label: "Année", value: formatRegistration(v.firstRegistration) },
    { icon: Gauge, label: "Kilométrage", value: formatKm(v.mileageKm) },
    { icon: Fuel, label: "Carburant", value: v.fuel ? (FUELS as Record<string, string>)[v.fuel] : null },
    { icon: Zap, label: "Puissance", value: formatPower(v.powerKw) },
  ].filter((k) => k.value);
  const url = siteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: title,
    brand: { "@type": "Brand", name: v.make },
    model: v.model,
    ...(v.version ? { vehicleConfiguration: v.version } : {}),
    ...(v.firstRegistration ? { dateVehicleFirstRegistered: v.firstRegistration } : {}),
    ...(v.mileageKm != null ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileageKm, unitCode: "KMT" } } : {}),
    ...(v.fuel ? { fuelType: (FUELS as Record<string, string>)[v.fuel] } : {}),
    ...(v.gearbox ? { vehicleTransmission: (GEARBOXES as Record<string, string>)[v.gearbox] } : {}),
    ...(v.color ? { color: v.color } : {}),
    ...(v.photos.length ? { image: v.photos.map((p) => `${url}${p}`) } : {}),
    ...(v.priceCents != null && !sold ? { offers: { "@type": "Offer", price: (v.priceCents / 100).toFixed(2), priceCurrency: "EUR", availability: v.status === "reserved" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock", seller: { "@type": "AutoDealer", name: b.name } } } : {}),
  };

  return (
    <VehicleShell business={b}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href={base} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" />Tous les véhicules</Link>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-8">
          <VehicleGallery photos={v.photos} title={title} />

          {key.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {key.map((k) => (
                <li key={k.label} className="rounded-xl border border-border bg-surface p-3">
                  <k.icon className="size-4 text-muted" aria-hidden="true" />
                  <p className="mt-1.5 text-xs text-muted">{k.label}</p>
                  <p className="font-semibold">{k.value}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {v.description ? (
            <section aria-labelledby="desc">
              <h2 id="desc" className="text-lg font-semibold">Description</h2>
              <p className="mt-2 max-w-prose whitespace-pre-line text-muted">{v.description}</p>
            </section>
          ) : null}

          <section aria-labelledby="carac">
            <h2 id="carac" className="text-lg font-semibold">Caractéristiques</h2>
            <dl className="mt-3 grid grid-cols-1 divide-y divide-border rounded-2xl border border-border bg-surface sm:grid-cols-2 sm:divide-y-0">
              {publicSpecs(v).map((r) => (
                <div key={r.label} className="flex justify-between gap-4 border-border px-4 py-2.5 text-sm sm:border-b">
                  <dt className="text-muted">{r.label}</dt>
                  <dd className="text-right font-medium">{r.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {v.equipment.length ? (
            <section aria-labelledby="equip">
              <h2 id="equip" className="text-lg font-semibold">Équipements</h2>
              <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {v.equipment.map((e) => <li key={e} className="flex items-center gap-2 text-sm"><Check className="size-4 shrink-0 text-success" aria-hidden="true" />{e}</li>)}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            {v.status === "reserved" ? <span className="mb-2 inline-flex rounded-md bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">Réservé</span> : null}
            {sold ? <span className="mb-2 inline-flex rounded-md bg-surface-muted px-2 py-0.5 text-xs font-semibold text-muted">Vendu</span> : null}
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
            <p className="mt-3 text-3xl font-semibold tabular-nums">{sold ? "Vendu" : formatPrice(v.priceCents)}</p>
            {!sold && v.priceCents != null ? <p className="mt-1 text-sm text-muted">{v.vatMode === "vat" ? "TVAC, TVA déductible pour un professionnel" : "TVA comprise (régime de la marge)"}</p> : null}
            <ul className="mt-4 space-y-1.5 text-sm">
              {v.carPass ? <li className="flex items-center gap-2"><BadgeCheck className="size-4 text-success" aria-hidden="true" />Car-Pass disponible</li> : null}
              {v.warrantyMonths ? <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" aria-hidden="true" />Garantie {v.warrantyMonths} mois</li> : null}
              {v.serviceHistory ? <li className="flex items-center gap-2"><Check className="size-4 text-success" aria-hidden="true" />Carnet d&apos;entretien complet</li> : null}
            </ul>
            {b.phone && !sold && mode !== "phone" ? (
              <a href={`tel:${b.phone.replace(/[^+0-9]/g, "")}`} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface text-sm font-semibold hover:bg-surface-muted">
                <Phone className="size-4" aria-hidden="true" />Appeler {b.phone}
              </a>
            ) : null}
          </div>
          {!sold ? (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-3 font-semibold">Je suis intéressé(e)</h2>
              <ContactBlock mode={mode} slug={slug} phone={b.phone} note={cs?.note ?? null} about={title} form={<VehicleInquiry slug={slug} vehicle={vehicle} title={title} />} />
            </div>
          ) : (
            <Link href={base} className="flex h-11 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground hover:bg-accent-hover">Voir les véhicules disponibles</Link>
          )}
        </aside>
      </div>

      {d.others.length ? (
        <section className="mt-14" aria-labelledby="autres">
          <h2 id="autres" className="text-lg font-semibold">Autres véhicules disponibles</h2>
          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {d.others.map((o) => <li key={o.id}><PublicVehicleCard v={o} base={base} /></li>)}
          </ul>
        </section>
      ) : null}
    </VehicleShell>
  );
}
