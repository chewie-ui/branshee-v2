import type { Metadata } from "next";
import { PrintToolbar } from "@/components/invoicing/print-toolbar";
import { DAY_SHORT, dayNum, fmtHours, isDay, isoWeek, mondayOf, shiftMinutes, todayIn, weekDays, weekRangeLabel } from "@/lib/planning";
import { requireContext } from "@/server/context";
import { weekPlanning } from "@/server/planning";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ semaine?: string }> }): Promise<Metadata> {
  const q = (await searchParams).semaine;
  return { title: { absolute: `Planning semaine ${isoWeek(mondayOf(isDay(q) ? q : new Date().toISOString().slice(0, 10)))}` }, robots: { index: false } };
}

/** Planning de la semaine en A4 paysage, pour l'afficher au mur ou l'enregistrer en PDF. */
export default async function PrintPlanning({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const ctx = await requireContext();
  const q = (await searchParams).semaine;
  const monday = mondayOf(isDay(q) ? q : todayIn(ctx.business.timezone));
  const days = weekDays(monday);
  const { members, shifts } = await weekPlanning(ctx, monday);
  return (
    <div className="min-h-dvh bg-surface-muted py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4 landscape; margin: 10mm; } @media print { html, body { background: #fff; } }`}</style>
      <PrintToolbar />
      <div className="mx-auto w-[1060px] max-w-full overflow-x-auto bg-white p-8 text-[12px] text-[#18181b] shadow-sm print:w-full print:p-0 print:shadow-none">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-lg font-semibold">{ctx.business.name} — Planning</p>
            <p className="text-[#52525b]">Semaine {isoWeek(monday)} · {weekRangeLabel(monday)}</p>
          </div>
          <p className="text-[#52525b]">Total équipe : {fmtHours(shifts.reduce((a, s) => a + shiftMinutes(s.start, s.end, s.breakMinutes), 0))}</p>
        </div>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th className="w-36 border border-[#d4d4d8] bg-[#f4f4f5] px-2 py-1.5 text-left">Personne</th>
              {days.map((d, i) => <th key={d} className="border border-[#d4d4d8] bg-[#f4f4f5] px-2 py-1.5 text-left">{DAY_SHORT[i]} {dayNum(d)}</th>)}
              <th className="w-16 border border-[#d4d4d8] bg-[#f4f4f5] px-2 py-1.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const mine = shifts.filter((s) => s.memberId === m.id);
              return (
                <tr key={m.id} className="break-inside-avoid">
                  <td className="border border-[#d4d4d8] px-2 py-1.5 align-top font-medium">{m.name}{m.role ? <span className="block font-normal text-[#52525b]">{m.role}</span> : null}</td>
                  {days.map((d) => (
                    <td key={d} className="border border-[#d4d4d8] px-2 py-1.5 align-top">
                      {mine.filter((s) => s.day === d).map((s) => (
                        <span key={s.id} className="block tabular-nums">{s.start}–{s.end}{s.label ? <span className="text-[#52525b]"> {s.label}</span> : null}</span>
                      ))}
                    </td>
                  ))}
                  <td className="border border-[#d4d4d8] px-2 py-1.5 text-right align-top tabular-nums">{fmtHours(mine.reduce((a, s) => a + shiftMinutes(s.start, s.end, s.breakMinutes), 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
