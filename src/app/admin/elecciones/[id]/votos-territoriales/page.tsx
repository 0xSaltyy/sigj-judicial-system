import { redirect } from "next/navigation";

export default async function TerritorialVotesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/elecciones/${id}/resultados`);
}
