import { redirect } from "next/navigation";

export default async function InstitutionCompatibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/dependencias/${id}`);
}
