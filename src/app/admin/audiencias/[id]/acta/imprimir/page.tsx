import { redirect } from "next/navigation";

export default async function LegacyHearingMinutePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/imprimir/actas/${id}`);
}
