import Image from "next/image";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin-page";
import { PrintButton } from "@/components/print-button";
import { requireInternalUser } from "@/lib/auth/authorization";

export default async function HearingMinutes({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { supabase }] = await Promise.all([params, requireInternalUser()]);
  const { data: hearing } = await supabase.from("hearings").select("*,case:cases(internal_number,judicial_number,title)").eq("id", id).maybeSingle();
  if (!hearing) notFound();
  const caseRecord = Array.isArray(hearing.case) ? hearing.case[0] : hearing.case;
  return <><AdminPageHeader title="Acta de audiencia" description={caseRecord?.internal_number ?? "Expediente"} action={<PrintButton label="Imprimir acta" />} /><article className="print-document rounded-lg border bg-white p-10"><header className="text-center"><Image src="/escudo-institucional.png" alt="Escudo institucional de Colombia" width={72} height={72} className="mx-auto size-[72px] object-contain" /><h1 className="mt-4 text-xl font-bold">ACTA DE AUDIENCIA</h1><p className="mono-number mt-3">{caseRecord?.judicial_number}</p></header><dl className="mt-8 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs font-semibold">Tipo</dt><dd>{hearing.hearing_type}</dd></div><div><dt className="text-xs font-semibold">Fecha</dt><dd>{new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" }).format(new Date(hearing.scheduled_at))}</dd></div><div><dt className="text-xs font-semibold">Sala</dt><dd>{hearing.room}</dd></div><div><dt className="text-xs font-semibold">Estado</dt><dd>{hearing.status}</dd></div></dl><h2 className="mt-8 font-semibold">Desarrollo y constancias</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{hearing.minutes_markdown || hearing.notes || "Acta pendiente de contenido."}</p></article></>;
}
