import { redirect } from "next/navigation";

export default async function ElectionMapRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/elecciones/${id}/votos-territoriales`);
}
