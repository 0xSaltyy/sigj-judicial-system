import { redirect } from "next/navigation";

export default async function LegacyCertificatePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/imprimir/constancias/${id}`);
}
