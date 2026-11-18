import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

/**
 * Rapport écrit au médecin prescripteur (continuité des soins), pré-rempli depuis le dossier kiné :
 * identité, prescription, diagnostic, résumé de l'examen et du traitement, évolution, conseils et suite.
 */
const s = (v: unknown) => (v == null ? "" : String(v)).replace(/[  ]/g, " ");
const st = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 46, fontSize: 10, color: "#18181b", fontFamily: "Helvetica", lineHeight: 1.45 },
  muted: { color: "#52525b" },
  h1: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 18 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 4, color: "#4f46e5" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  box: { marginTop: 12, padding: 10, backgroundColor: "#f4f4f5", borderRadius: 6 },
});

export type CareReport = {
  practice: { name: string; author: string; inami?: string | null; address: string; phone?: string | null; email?: string | null };
  patient: { name: string; niss?: string | null; birthDate?: string | null; mutuality?: string | null };
  episode: { title: string; prescriber?: string | null; prescriberInami?: string | null; prescriptionDate?: string | null; kind: string; sessionsDone: number; sessionsPrescribed?: number | null; closed: boolean };
  sections: { label: string; items: { date?: string | null; text: string }[] }[];
  date: string;
};

const day = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

export async function careReportPdf(r: CareReport) {
  return renderToBuffer(
    <Document title={`Rapport kinésithérapeutique — ${s(r.patient.name)}`} author={s(r.practice.author)} creator="Skydev" producer="Skydev">
      <Page size="A4" style={st.page}>
        <View style={st.row}>
          <View>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{s(r.practice.name)}</Text>
            <Text style={st.muted}>{s(r.practice.author)}{r.practice.inami ? ` · INAMI ${s(r.practice.inami)}` : ""}</Text>
            {r.practice.address ? <Text style={st.muted}>{s(r.practice.address)}</Text> : null}
            {r.practice.phone || r.practice.email ? <Text style={st.muted}>{[r.practice.phone, r.practice.email].filter(Boolean).map(s).join(" · ")}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={st.muted}>Le {day(r.date)}</Text>
            {r.episode.prescriber ? <Text style={{ marginTop: 8 }}>À l&apos;attention de {s(r.episode.prescriber)}</Text> : null}
            {r.episode.prescriberInami ? <Text style={st.muted}>INAMI {s(r.episode.prescriberInami)}</Text> : null}
          </View>
        </View>
        <Text style={st.h1}>Rapport kinésithérapeutique{r.episode.closed ? " de fin de traitement" : " intermédiaire"}</Text>
        <View style={st.box}>
          <Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Patient : </Text>{s(r.patient.name)}{r.patient.birthDate ? `, né(e) le ${day(r.patient.birthDate)}` : ""}</Text>
          {r.patient.niss ? <Text>NISS : {s(r.patient.niss)}</Text> : null}
          {r.patient.mutuality ? <Text>Mutuelle : {s(r.patient.mutuality)}</Text> : null}
          <Text><Text style={{ fontFamily: "Helvetica-Bold" }}>Motif : </Text>{s(r.episode.title)} ({s(r.episode.kind)})</Text>
          <Text>Prescription{r.episode.prescriptionDate ? ` du ${day(r.episode.prescriptionDate)}` : ""} · {r.episode.sessionsDone} séance{r.episode.sessionsDone > 1 ? "s" : ""} réalisée{r.episode.sessionsDone > 1 ? "s" : ""}{r.episode.sessionsPrescribed ? ` sur ${r.episode.sessionsPrescribed} prescrites` : ""}</Text>
        </View>
        {r.sections.filter((x) => x.items.length).map((sec) => (
          <View key={sec.label} wrap>
            <Text style={st.h2}>{s(sec.label)}</Text>
            {sec.items.map((it, i) => (
              <Text key={i} style={{ marginBottom: 4 }}>{it.date ? <Text style={{ fontFamily: "Helvetica-Bold" }}>{day(it.date)} — </Text> : null}{s(it.text)}</Text>
            ))}
          </View>
        ))}
        <Text style={{ marginTop: 22 }}>Confraternellement,</Text>
        <Text style={{ fontFamily: "Helvetica-Bold" }}>{s(r.practice.author)}</Text>
        <Text style={[st.muted, { position: "absolute", bottom: 20, left: 46, right: 46, fontSize: 7.5, textAlign: "center" }]} fixed>Document confidentiel couvert par le secret professionnel — destiné au médecin prescripteur.</Text>
      </Page>
    </Document>,
  );
}
