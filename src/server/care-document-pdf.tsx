import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

/** Document INAMI (rapport, demande, notification, courrier) mis en page : en-tête du cabinet, destinataire, contenu. */
const s = (v: unknown) => (v == null ? "" : String(v)).replace(/[  ]/g, " ");
const st = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 46, paddingHorizontal: 46, fontSize: 10, color: "#18181b", fontFamily: "Helvetica", lineHeight: 1.45 },
  muted: { color: "#52525b" },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 8 },
  h2: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 2, color: "#4f46e5" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  draft: { position: "absolute", top: 330, left: 70, fontSize: 70, color: "#e4e4e7", transform: "rotate(-30deg)", fontFamily: "Helvetica-Bold" },
});

export type CareDocPdf = {
  practice: { name: string; author: string; inami?: string | null; address: string; phone?: string | null; email?: string | null };
  recipient: { name?: string | null; inami?: string | null };
  title: string;
  content: string;
  date: string;
  version: number;
  draft: boolean;
};

const day = (iso: string) => iso.split("-").reverse().join("/");
const isHeading = (l: string) => l.length < 60 && /[A-ZÀ-Ý]/.test(l) && !/[a-zà-ÿ]/.test(l);

export async function careDocumentPdf(d: CareDocPdf) {
  const blocks = d.content.split(/\n{2,}/);
  return renderToBuffer(
    <Document title={s(d.title)} author={s(d.practice.author)} creator="Skydev" producer="Skydev">
      <Page size="A4" style={st.page}>
        {d.draft ? <Text style={st.draft} fixed>BROUILLON</Text> : null}
        <View style={st.row}>
          <View>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{s(d.practice.name)}</Text>
            <Text style={st.muted}>{s(d.practice.author)}{d.practice.inami ? ` · INAMI ${s(d.practice.inami)}` : ""}</Text>
            {d.practice.address ? <Text style={st.muted}>{s(d.practice.address)}</Text> : null}
            {d.practice.phone || d.practice.email ? <Text style={st.muted}>{[d.practice.phone, d.practice.email].filter(Boolean).map(s).join(" · ")}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end", maxWidth: 220 }}>
            <Text style={st.muted}>Le {day(d.date)}</Text>
            {d.recipient.name ? <Text style={{ marginTop: 8, textAlign: "right" }}>À l&apos;attention de {s(d.recipient.name)}</Text> : null}
            {d.recipient.inami ? <Text style={st.muted}>INAMI {s(d.recipient.inami)}</Text> : null}
          </View>
        </View>
        <Text style={st.h1}>{s(d.title)}</Text>
        {blocks.map((b, i) => {
          const t = b.trim();
          if (!t) return null;
          if (isHeading(t)) return <Text key={i} style={st.h2}>{s(t)}</Text>;
          return <Text key={i} style={{ marginBottom: 6 }}>{s(t)}</Text>;
        })}
        <Text style={[st.muted, { position: "absolute", bottom: 20, left: 46, right: 46, fontSize: 7.5, textAlign: "center" }]} fixed render={({ pageNumber, totalPages }) => `Document confidentiel couvert par le secret professionnel · version ${d.version} · page ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>,
  );
}
