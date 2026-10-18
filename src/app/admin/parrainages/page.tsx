import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSuperadmin } from "@/server/admin";

export const metadata: Metadata = { title: "Parrainages" };

/** Parrains : filleuls inscrits, filleuls payants, mois offerts déjà réclamés (2 mois par 3 filleuls payants). */
export default async function AdminReferrals() {
  await requireSuperadmin();
  const rows = await db.execute<{ id: string; name: string; email: string; code: string | null; invited: number; paying: number; claimed: number }>(sql`
    select p.id, p.full_name as name, p.email, p.referral_code as code,
      count(f.id)::int as invited,
      count(f.referral_paid_at)::int as paying,
      coalesce((select months_claimed from referral_credits rc where rc.user_id = p.id), 0) as claimed
    from users p join users f on f.referred_by_id = p.id
    group by p.id order by paying desc, invited desc limit 200`);
  const totals = rows.reduce((a, r) => ({ invited: a.invited + r.invited, paying: a.paying + r.paying }), { invited: 0, paying: 0 });
  return (
    <>
      <PageHeader title="Parrainages" description={`${rows.length} parrain${rows.length > 1 ? "s" : ""} · ${totals.invited} filleul${totals.invited > 1 ? "s" : ""} dont ${totals.paying} payant${totals.paying > 1 ? "s" : ""}`} />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">Parrain</th>
              <th className="px-3 py-2.5 font-medium">Code</th>
              <th className="px-3 py-2.5 text-right font-medium">Filleuls</th>
              <th className="px-3 py-2.5 text-right font-medium">Payants</th>
              <th className="px-5 py-2.5 text-right font-medium">Mois réclamés</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3">
                  <Link href={`/admin/utilisateurs/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                  <span className="block text-muted">{r.email}</span>
                </td>
                <td className="px-3 py-3 font-mono">{r.code ?? "—"}</td>
                <td className="px-3 py-3 text-right tabular-nums">{r.invited}</td>
                <td className="px-3 py-3 text-right tabular-nums">{r.paying}</td>
                <td className="px-5 py-3 text-right tabular-nums">{r.claimed}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-4 text-muted">Aucun parrainage pour le moment.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </>
  );
}
