import "server-only";

/** CSV compatible Excel (séparateur « ; », BOM UTF-8), cellules protégées contre l'injection de formules. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    // Un nombre négatif (« -12,50 ») reste un nombre ; tout autre début suspect est neutralisé.
    if (/^[=+\-@\t\r]/.test(s) && !/^-\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

export function csvResponse(name: string, body: string) {
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
