import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { DocParty, DocView } from "@/components/invoicing/invoice-document";
import { bceFmt, docTitle, fdate, ibanFmt, money, num, totals } from "@/lib/invoicing";

/**
 * Vrai fichier PDF (A4, texte sélectionnable) d'une facture, note de crédit ou devis : même contenu et mêmes
 * mentions belges que la feuille affichée à l'écran. Polices standard du PDF (Helvetica).
 */
const s = (v: unknown) => (v == null ? "" : String(v)).replace(/[  ]/g, " ");
const m = (n: number) => s(money(n));

const st = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 34, paddingHorizontal: 44, fontSize: 9.5, color: "#18181b", fontFamily: "Helvetica", lineHeight: 1.4 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, height: 6 },
  muted: { color: "#52525b" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  th: { fontSize: 7.5, color: "#52525b", textTransform: "uppercase", fontFamily: "Helvetica-Bold", paddingVertical: 6 },
  td: { paddingVertical: 6 },
});

export async function invoicePdf({ doc, seller, client, qr }: { doc: DocView; seller: DocParty; client: DocParty | null; qr?: string | null }) {
  const fr = s(seller.vatRegime || "franchise") === "franchise";
  const t = totals(doc.lines, fr ? "franchise" : "assujetti");
  const isQuote = doc.docType === "quote";
  const isCredit = doc.docType === "credit";
  const color = /^#[0-9a-f]{6}$/i.test(s(seller.color)) ? s(seller.color) : "#4f46e5";
  const dname = s(seller.tradeName) || s(seller.legalName) || "Votre entreprise";
  const addr = (o: DocParty) => [s(o.street), [s(o.zip), s(o.city)].filter(Boolean).join(" "), o.country && o.country !== "Belgique" ? s(o.country) : ""].filter(Boolean);
  const draft = !isQuote && doc.status === "draft";
  const meta: [string, string][] = [["N°", doc.number || (isQuote ? "—" : "Attribué à l'émission")], ["Date", fdate(doc.issueDate)]];
  if (!isQuote && !isCredit && doc.serviceDate && doc.serviceDate !== doc.issueDate) meta.push(["Prestation", fdate(doc.serviceDate)]);
  if (!isQuote && !isCredit) meta.push(["Échéance", fdate(doc.dueDate)]);
  if (isQuote) meta.push(["Valable jusqu'au", fdate(doc.validUntil)]);
  const rows = doc.lines.filter((l) => l.desc || num(l.price));
  const legal: string[] = [];
  if (isCredit && doc.related?.number) legal.push(`Note de crédit relative à la facture n° ${doc.related.number} du ${fdate(doc.related.issueDate)}.`);
  if (fr) legal.push(isQuote ? "Régime particulier de franchise des petites entreprises — prix sans TVA." : "Régime particulier de franchise des petites entreprises.");
  const foot = [dname, s(seller.legalForm), seller.bce ? `N° d'entreprise ${bceFmt(s(seller.bce))}` : "", seller.vatNumber && !fr ? `TVA ${s(seller.vatNumber)}` : "", seller.iban ? `IBAN ${ibanFmt(s(seller.iban))}` : ""].filter(Boolean).join(" · ");
  const w = fr ? ["46%", "10%", "14%", "15%", "15%"] : ["38%", "9%", "12%", "14%", "10%", "17%"];

  const pdf = (
    <Document title={`${docTitle(doc.docType)} ${doc.number ?? "brouillon"}`} author={dname} creator="Skydev" producer="Skydev">
      <Page size="A4" style={st.page}>
        <View style={[st.bar, { backgroundColor: color }]} fixed />
        {draft ? <Text style={{ position: "absolute", top: 330, left: 70, fontSize: 90, color: "#18181b", opacity: 0.05, transform: "rotate(-24deg)", fontFamily: "Helvetica-Bold" }} fixed>BROUILLON</Text> : null}
        <View style={st.row}>
          <View style={{ width: 250 }}>
            <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{dname}</Text>
            {seller.tradeName && seller.legalName && seller.tradeName !== seller.legalName ? <Text style={st.muted}>{s(seller.legalName)}</Text> : null}
            {addr(seller).map((l) => <Text key={l} style={st.muted}>{l}</Text>)}
            {seller.bce ? <Text style={st.muted}>N° d&apos;entreprise : {bceFmt(s(seller.bce))}</Text> : null}
            {seller.vatNumber && !fr ? <Text style={st.muted}>TVA : {s(seller.vatNumber)}</Text> : null}
            <Text style={st.muted}>{[s(seller.email), s(seller.phone)].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 22, lineHeight: 1.15, fontFamily: "Helvetica-Bold", color }}>{docTitle(doc.docType)}</Text>
            <View style={{ marginTop: 10 }}>
              {meta.map(([a, b]) => (
                <View key={a} style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
                  <Text style={st.muted}>{a}</Text>
                  <Text style={{ fontFamily: "Helvetica-Bold", minWidth: 70, textAlign: "right" }}>{s(b)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={{ marginTop: 24, alignItems: "flex-end" }}>
          <View style={{ width: 250, borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 8, padding: 10 }}>
            <Text style={[st.th, { paddingVertical: 0, marginBottom: 3 }]}>{isQuote ? "Destinataire" : "Facturé à"}</Text>
            {client?.name ? (
              <>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{s(client.name)}</Text>
                {client.contact ? <Text>{s(client.contact)}</Text> : null}
                {addr(client).map((l) => <Text key={l}>{l}</Text>)}
                {client.vat ? <Text style={st.muted}>TVA / N° d&apos;entreprise : {s(client.vat)}</Text> : null}
              </>
            ) : <Text style={st.muted}>—</Text>}
          </View>
        </View>

        <View style={{ marginTop: 22 }}>
          <View style={{ flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: color }}>
            {["Description", "Qté", "Unité", `Prix unit.${fr ? "" : " HTVA"}`, ...(fr ? [] : ["TVA"]), `Total${fr ? "" : " HTVA"}`].map((h, i, a) => (
              <Text key={h} style={[st.th, { width: w[i], textAlign: i === 0 || i === 2 ? "left" : "right", paddingRight: i === a.length - 1 ? 0 : 6 }]}>{h}</Text>
            ))}
          </View>
          {rows.map((l) => {
            const cells = [s(l.desc), String(num(l.qty)).replace(".", ","), s(l.unit), m(num(l.price)), ...(fr ? [] : [`${num(l.vat)} %`]), m(num(l.qty) * num(l.price))];
            return (
              <View key={l.id} style={{ flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e4e4e7" }} wrap={false}>
                {cells.map((c, i) => <Text key={i} style={[st.td, { width: w[i], textAlign: i === 0 || i === 2 ? "left" : "right", paddingRight: i === cells.length - 1 ? 0 : 6 }]}>{c}</Text>)}
              </View>
            );
          })}
        </View>

        <View style={[st.row, { marginTop: 14, alignItems: "flex-start" }]} wrap={false}>
          <Text style={[st.muted, { width: 240 }]}>{s(doc.notes)}</Text>
          <View style={{ width: 210 }}>
            {fr ? null : (
              <>
                <View style={st.row}><Text>Total HTVA</Text><Text>{m(t.ht)}</Text></View>
                {t.vatRows.map((v) => <View key={v.rate} style={st.row}><Text style={st.muted}>TVA {v.rate} % sur {m(v.base)}</Text><Text style={st.muted}>{m(v.amt)}</Text></View>)}
              </>
            )}
            <View style={[st.row, { marginTop: 5, backgroundColor: color, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8 }]}>
              <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 11 }}>{isCredit ? "Total crédité" : isQuote ? "Total" : "Total à payer"}{fr ? "" : " TVAC"}</Text>
              <Text style={{ color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 11 }}>{m(fr ? t.ht : t.ttc)}</Text>
            </View>
          </View>
        </View>

        {!isQuote && !isCredit ? (
          <View style={[st.row, { marginTop: 18, backgroundColor: "#f4f4f5", borderRadius: 8, padding: 10, alignItems: "center" }]} wrap={false}>
            <View>
              {[["À payer avant le", fdate(doc.dueDate)], ["IBAN", ibanFmt(s(seller.iban)) || "—"], ...(seller.bic ? [["BIC", s(seller.bic)]] : []), ["Communication", s(doc.comm) || "Attribuée à l'émission"], ["Bénéficiaire", dname]].map(([a, b]) => (
                <View key={a} style={{ flexDirection: "row" }}><Text style={[st.muted, { width: 95 }]}>{a}</Text><Text style={{ fontFamily: "Helvetica-Bold" }}>{s(b)}</Text></View>
              ))}
            </View>
            {qr ? (
              <View style={{ alignItems: "center" }}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={qr} style={{ width: 68, height: 68 }} />
                <Text style={[st.muted, { fontSize: 7, marginTop: 2 }]}>Scanner pour payer</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ position: "absolute", left: 44, right: 44, bottom: 28 }} fixed>
          {legal.map((l) => <Text key={l} style={[st.muted, { fontSize: 8.5, marginBottom: 2 }]}>{l}</Text>)}
          <View style={{ borderTopWidth: 0.5, borderTopColor: "#e4e4e7", paddingTop: 5, marginTop: 4 }}>
            {seller.footerNote ? <Text style={[st.muted, { fontSize: 7.5, textAlign: "center" }]}>{s(seller.footerNote)}</Text> : null}
            <Text style={[st.muted, { fontSize: 7.5, textAlign: "center" }]}>{foot}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(pdf);
}

/** Nom de fichier sûr : « Facture SKY-2026-001.pdf ». */
export const pdfFileName = (doc: { docType: DocView["docType"]; number: string | null }) => `${docTitle(doc.docType)} ${doc.number ?? "brouillon"}`.replace(/[^\p{L}\p{N} ._-]/gu, "") + ".pdf";
