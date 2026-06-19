import { redirect } from "next/navigation";
export default async function ProvidenceSignaturesPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/admin/providencias/${id}#firmas`); }
