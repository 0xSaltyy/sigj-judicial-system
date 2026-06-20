import { redirect } from "next/navigation";

export default async function LegacyCasePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/imprimir/expedientes/${id}`);
}
