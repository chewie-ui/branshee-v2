import { bceFmt, docTitle, fdate, ibanFmt, money, num, totals, type DocType, type SalesLine } from "@/lib/invoicing";

export type DocParty = { [k: string]: string | number | undefined };
export type DocView = {
  docType: DocType;
  status: string;
  number: string | null;
  issueDate: string;
  serviceDate?: string | null;
  dueDate?: string | null;
  validUntil?: string | null;
  comm?: string | null;
  notes?: string | null;
  lines: SalesLine[];
  related?: { number: string | null; issueDate: string } | null;
};

const s = (v: unknown) => (v == null ? "" : String(v));

/**
 * Feuille A4 (794 × 1123 px) d'une facture, note de crédit ou devis, avec toutes les mentions belges.
 * Rendue telle quelle dans l'aperçu, la fiche et la page d'impression (PDF).
 */
export function InvoiceDocument({ doc, seller, client, qr }: { doc: DocView; seller: DocParty; client: DocParty | null; qr?: string | null }) {
  const fr = s(seller.vatRegime || "franchise") === "franchise";
  const t = totals(doc.lines, fr ? "franchise" : "assujetti");
  const isQuote = doc.docType === "quote";
  const isCredit = doc.docType === "credit";
  const color = /^#[0-9a-f]{6}$/i.test(s(seller.color)) ? s(seller.color) : "#4f46e5";
  const dname = s(seller.tradeName) || s(seller.legalName) || "Votre entreprise";
  const initials = dname.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const addr = (o: DocParty) => [s(o.street), [s(o.zip), s(o.city)].filter(Boolean).join(" "), o.country && o.country !== "Belgique" ? s(o.country) : ""].filter(Boolean);
  const draft = !isQuote && doc.status === "draft";
  const number = doc.number || (isQuote ? "—" : "Attribué à l'émission");
  const meta: [string, string][] = [["N°", number], ["Date", fdate(doc.issueDate)]];
  if (!isQuote && !isCredit && doc.serviceDate && doc.serviceDate !== doc.issueDate) meta.push(["Prestation", fdate(doc.serviceDate)]);
  if (!isQuote && !isCredit) meta.push(["Échéance", fdate(doc.dueDate)]);
  if (isQuote) meta.push(["Valable jusqu'au", fdate(doc.validUntil)]);
  const rows = doc.lines.filter((l) => l.desc || num(l.price));
  const legal: string[] = [];
  if (isCredit && doc.related?.number) legal.push(`Note de crédit relative à la facture n° ${doc.related.number} du ${fdate(doc.related.issueDate)}.`);
  if (fr) legal.push(isQuote ? "Régime particulier de franchise des petites entreprises — prix sans TVA." : "Régime particulier de franchise des petites entreprises.");
  const foot = [dname, s(seller.legalForm), seller.bce ? `N° d'entreprise ${bceFmt(s(seller.bce))}` : "", seller.vatNumber && !fr ? `TVA ${s(seller.vatNumber)}` : "", seller.iban ? `IBAN ${ibanFmt(s(seller.iban))}` : ""].filter(Boolean).join(" · ");
  const cell = "px-3 py-2.5 align-top";

  return (
    <div className="relative flex h-[1123px] w-[794px] flex-col overflow-hidden bg-white px-14 pt-12 pb-10 text-[13px] leading-[1.45] text-[#18181b]" style={{ fontFamily: "var(--font-sans)" }}>
      <div className="absolute inset-x-0 top-0 h-2" style={{ background: color }} />
      {draft ? <div className="pointer-events-none absolute top-[420px] left-1/2 -translate-x-1/2 -rotate-[24deg] text-[110px] font-bold tracking-widest text-[#18181b]/[0.05]">BROUILLON</div> : null}

      <div className="flex items-start justify-between gap-8">
        <div className="max-w-[330px]">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl text-lg font-semibold text-white" style={{ background: color }}>{initials || "·"}</div>
          <p className="text-[17px] font-semibold">{dname}</p>
          {seller.tradeName && seller.legalName && seller.tradeName !== seller.legalName ? <p className="text-[#52525b]">{s(seller.legalName)}</p> : null}
          <p className="text-[#52525b]">{addr(seller).length ? addr(seller).map((l) => <span key={l} className="block">{l}</span>) : "Votre adresse"}</p>
          {seller.bce ? <p className="text-[#52525b]">N° d&apos;entreprise : {bceFmt(s(seller.bce))}</p> : null}
          {seller.vatNumber && !fr ? <p className="text-[#52525b]">TVA : {s(seller.vatNumber)}</p> : null}
          <p className="text-[#52525b]">{[s(seller.email), s(seller.phone)].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right">
          <p className="text-[30px] leading-tight font-semibold tracking-tight" style={{ color }}>{docTitle(doc.docType)}</p>
          <dl className="mt-3 grid grid-cols-[auto_auto] justify-end gap-x-4 gap-y-1">
            {meta.map(([a, b]) => (
              <div key={a} className="contents">
                <dt className="text-[#52525b]">{a}</dt>
                <dd className="font-medium tabular-nums">{b}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-9 flex justify-end">
        <div className="w-[330px] rounded-xl border border-[#e4e4e7] p-4">
          <p className="mb-1 text-[11px] font-semibold tracking-wider text-[#52525b] uppercase">{isQuote ? "Destinataire" : "Facturé à"}</p>
          {client?.name ? (
            <>
              <p className="font-semibold">{s(client.name)}</p>
              {client.contact ? <p>{s(client.contact)}</p> : null}
              {addr(client).map((l) => <p key={l}>{l}</p>)}
              {client.vat ? <p className="text-[#52525b]">TVA / N° d&apos;entreprise : {s(client.vat)}</p> : null}
            </>
          ) : (
            <p className="text-[#52525b]">Choisissez un client</p>
          )}
        </div>
      </div>

      <table className="mt-8 w-full border-collapse">
        <thead>
          <tr className="border-b-2 text-left text-[11px] tracking-wider text-[#52525b] uppercase" style={{ borderColor: color }}>
            <th className={cell + " pl-0 font-semibold"}>Description</th>
            <th className={cell + " text-right font-semibold"}>Qté</th>
            <th className={cell + " font-semibold"}>Unité</th>
            <th className={cell + " text-right font-semibold"}>Prix unit.{fr ? "" : " HTVA"}</th>
            {fr ? null : <th className={cell + " text-right font-semibold"}>TVA</th>}
            <th className={cell + " pr-0 text-right font-semibold"}>Total{fr ? "" : " HTVA"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((l) => (
              <tr key={l.id} className="border-b border-[#e4e4e7]">
                <td className={cell + " pl-0 whitespace-pre-line"}>{l.desc}</td>
                <td className={cell + " text-right tabular-nums"}>{String(num(l.qty)).replace(".", ",")}</td>
                <td className={cell}>{l.unit}</td>
                <td className={cell + " text-right tabular-nums"}>{money(num(l.price))}</td>
                {fr ? null : <td className={cell + " text-right tabular-nums"}>{num(l.vat)} %</td>}
                <td className={cell + " pr-0 text-right tabular-nums"}>{money(num(l.qty) * num(l.price))}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={fr ? 5 : 6} className="py-8 text-center text-[#52525b]">Ajoutez une ligne pour la voir ici.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-5 flex items-start justify-between gap-8">
        <p className="max-w-[330px] whitespace-pre-line text-[#52525b]">{doc.notes}</p>
        <div className="w-[280px] space-y-1.5">
          {fr ? null : (
            <>
              <div className="flex justify-between"><span>Total HTVA</span><span className="tabular-nums">{money(t.ht)}</span></div>
              {t.vatRows.map((v) => (
                <div key={v.rate} className="flex justify-between text-[#52525b]"><span>TVA {v.rate} % sur {money(v.base)}</span><span className="tabular-nums">{money(v.amt)}</span></div>
              ))}
            </>
          )}
          <div className="flex justify-between rounded-lg px-3 py-2 text-[15px] font-semibold text-white" style={{ background: color }}>
            <span>{isCredit ? "Total crédité" : isQuote ? "Total" : "Total à payer"}{fr ? "" : " TVAC"}</span>
            <span className="tabular-nums">{money(fr ? t.ht : t.ttc)}</span>
          </div>
        </div>
      </div>

      {!isQuote && !isCredit ? (
        <div className="mt-7 flex items-center justify-between gap-6 rounded-xl bg-[#f4f4f5] p-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1">
            <dt className="text-[#52525b]">À payer avant le</dt><dd className="font-medium">{fdate(doc.dueDate)}</dd>
            <dt className="text-[#52525b]">IBAN</dt><dd className="font-medium tabular-nums">{ibanFmt(s(seller.iban)) || "—"}</dd>
            {seller.bic ? (<><dt className="text-[#52525b]">BIC</dt><dd className="font-medium">{s(seller.bic)}</dd></>) : null}
            <dt className="text-[#52525b]">Communication</dt><dd className="font-medium tabular-nums">{doc.comm || "Attribuée à l'émission"}</dd>
            <dt className="text-[#52525b]">Bénéficiaire</dt><dd className="font-medium">{dname}</dd>
          </dl>
          {qr ? (
            <div className="flex flex-col items-center gap-1 text-[11px] text-[#52525b]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code de paiement" className="size-[92px]" />
              Scanner pour payer
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto space-y-3 pt-6">
        {legal.length ? <div className="text-[12px] text-[#52525b]">{legal.map((l) => <p key={l}>{l}</p>)}</div> : null}
        <div className="border-t border-[#e4e4e7] pt-3 text-center text-[11px] text-[#52525b]">
          {seller.footerNote ? <p>{s(seller.footerNote)}</p> : null}
          <p>{foot}</p>
        </div>
      </div>
    </div>
  );
}
