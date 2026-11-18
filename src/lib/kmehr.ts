/**
 * Kmehr (standard belge des messages de santé) : lecture des informations utiles d'un message reçu
 * (patient, expéditeur, date, texte) et écriture d'un message « rapport » pour un document de soins.
 * Versions des tables (SV) à confirmer lors du test eHealth (mini-lab).
 * Lecteur volontairement tolérant (préfixes d'espace de noms, ordre des éléments) ; pas de dépendance externe.
 */

const NS = "(?:[A-Za-z][\\w.-]*:)?";

export function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

export const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Contenu des éléments `tag` (premier niveau trouvé, dans l'ordre). */
function blocks(xml: string, tag: string): { attrs: string; inner: string }[] {
  const re = new RegExp(`<${NS}${tag}(\\s[^>]*)?>([\\s\\S]*?)</${NS}${tag}>`, "g");
  const out: { attrs: string; inner: string }[] = [];
  for (const m of xml.matchAll(re)) out.push({ attrs: m[1] ?? "", inner: m[2] ?? "" });
  return out;
}
const first = (xml: string, tag: string) => blocks(xml, tag)[0] ?? null;
const text = (xml: string | undefined | null, tag: string) => {
  if (!xml) return null;
  const b = first(xml, tag);
  return b ? decodeXml(b.inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || null : null;
};
const attr = (attrs: string, name: string) => attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`))?.[1] ?? null;
/** Valeur d'un `<id S="...">` ou `<cd S="...">` d'un schéma donné. */
function idOf(xml: string, tag: "id" | "cd", scheme: string) {
  for (const b of blocks(xml, tag)) if (attr(b.attrs, "S") === scheme) return decodeXml(b.inner).trim();
  return null;
}

export type KmehrInfo = {
  date: string | null;
  sender: { name: string | null; inami: string | null };
  patient: { niss: string | null; firstName: string | null; lastName: string | null; birthDate: string | null; sex: string | null };
  title: string | null;
  text: string;
  transactionType: string | null;
};

/** Lit un message Kmehr ; `null` si ce n'est pas un message Kmehr. */
export function parseKmehr(xml: string): KmehrInfo | null {
  if (!new RegExp(`<${NS}kmehrmessage[\\s>]`).test(xml)) return null;
  const header = first(xml, "header")?.inner ?? "";
  const sender = first(header, "sender")?.inner ?? "";
  const hcparties = blocks(sender, "hcparty");
  // L'expéditeur peut être une organisation contenant une personne : on garde la personne si elle existe.
  const person = hcparties.find((h) => idOf(h.inner, "id", "ID-HCPARTY") && (text(h.inner, "familyname") || text(h.inner, "firstname"))) ?? hcparties[0];
  const senderName = person ? [text(person.inner, "firstname"), text(person.inner, "familyname")].filter(Boolean).join(" ") || text(person.inner, "name") : null;
  const patient = first(xml, "patient")?.inner ?? "";
  const birth = first(patient, "birthdate")?.inner ?? "";
  const tx = first(xml, "transaction")?.inner ?? "";
  const texts = [...blocks(tx, "text"), ...blocks(tx, "TextWithLayout")].map((b) => decodeXml(b.inner.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "")).trim()).filter(Boolean);
  const sexCd = idOf(patient, "cd", "CD-SEX");
  return {
    date: text(header, "date"),
    sender: { name: senderName || null, inami: person ? idOf(person.inner, "id", "ID-HCPARTY") : null },
    patient: {
      niss: idOf(patient, "id", "ID-PATIENT"),
      firstName: text(patient, "firstname"),
      lastName: text(patient, "familyname"),
      birthDate: text(birth, "date"),
      sex: sexCd === "male" ? "M" : sexCd === "female" ? "F" : sexCd ? "X" : null,
    },
    title: idOf(tx, "cd", "CD-TRANSACTION"),
    transactionType: idOf(tx, "cd", "CD-TRANSACTION"),
    text: texts.join("\n\n"),
  };
}

export type KmehrReport = {
  messageId: string;
  date: string;
  time: string;
  sender: { inami: string | null; firstName: string; lastName: string; practice: string };
  recipient: { inami: string | null; name: string | null };
  patient: { niss: string | null; firstName: string; lastName: string; birthDate: string | null; sex: string | null };
  title: string;
  text: string;
  language: string;
};

const hcparty = (p: { inami: string | null; cd: string; first?: string; last?: string; name?: string | null }) =>
  `<hcparty>${p.inami ? `<id S="ID-HCPARTY" SV="1.0">${escapeXml(p.inami.replace(/\D/g, ""))}</id>` : ""}<cd S="CD-HCPARTY" SV="1.0">${p.cd}</cd>${p.first ? `<firstname>${escapeXml(p.first)}</firstname>` : ""}${p.last ? `<familyname>${escapeXml(p.last)}</familyname>` : ""}${p.name ? `<name>${escapeXml(p.name)}</name>` : ""}</hcparty>`;

/** Message Kmehr « rapport » (texte libre) d'un document de soins, prêt à être joint ou envoyé. */
export function buildKmehrReport(r: KmehrReport) {
  const sex = r.patient.sex === "M" ? "male" : r.patient.sex === "F" ? "female" : "unknown";
  const author = hcparty({ inami: r.sender.inami, cd: "persphysiotherapist", first: r.sender.firstName, last: r.sender.lastName });
  return `<?xml version="1.0" encoding="UTF-8"?>
<kmehrmessage xmlns="http://www.ehealth.fgov.be/standards/kmehr/schema/v1">
  <header>
    <standard><cd S="CD-STANDARD" SV="1.0">20161201</cd></standard>
    <id S="ID-KMEHR" SV="1.0">${escapeXml(`${(r.sender.inami ?? "0").replace(/\D/g, "")}.${r.messageId}`)}</id>
    <date>${r.date}</date>
    <time>${r.time}</time>
    <sender>${author}</sender>
    <recipient>${hcparty({ inami: r.recipient.inami, cd: "persphysician", name: r.recipient.name })}</recipient>
  </header>
  <folder>
    <id S="ID-KMEHR" SV="1.0">1</id>
    <patient>
      ${r.patient.niss ? `<id S="ID-PATIENT" SV="1.0">${escapeXml(r.patient.niss)}</id>` : ""}
      <firstname>${escapeXml(r.patient.firstName)}</firstname>
      <familyname>${escapeXml(r.patient.lastName)}</familyname>
      ${r.patient.birthDate ? `<birthdate><date>${r.patient.birthDate}</date></birthdate>` : ""}
      <sex><cd S="CD-SEX" SV="1.0">${sex}</cd></sex>
    </patient>
    <transaction>
      <id S="ID-KMEHR" SV="1.0">1</id>
      <cd S="CD-TRANSACTION" SV="1.0">report</cd>
      <date>${r.date}</date>
      <time>${r.time}</time>
      <author>${author}</author>
      <iscomplete>true</iscomplete>
      <isvalidated>true</isvalidated>
      <item>
        <id S="ID-KMEHR" SV="1.0">1</id>
        <cd S="CD-ITEM" SV="1.0">conclusion</cd>
        <content><text L="${escapeXml(r.language)}">${escapeXml(`${r.title}\n\n${r.text}`)}</text></content>
      </item>
    </transaction>
  </folder>
</kmehrmessage>
`;
}
