import Link from "next/link";
import { FilePenLine, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HearingMinuteActions({
  hearingId,
  minuteStatus,
  canView,
  canCreate,
  canEdit,
  archived = false,
}: {
  hearingId: string;
  minuteStatus?: string | null;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  archived?: boolean;
}) {
  const editorUrl = `/admin/audiencias/${hearingId}/acta`;
  const printUrl = `/imprimir/actas/${hearingId}`;

  if (!minuteStatus) {
    if (canCreate && !archived) {
      return (
        <Button asChild size="sm" className="bg-[#153b5c]">
          <Link href={editorUrl}><FilePenLine className="size-4" /> Realizar acta de audiencia</Link>
        </Button>
      );
    }
    return <Button size="sm" disabled title={archived ? "La audiencia está archivada" : "No tiene permiso para crear actas"}><FilePenLine className="size-4" /> Realizar acta de audiencia</Button>;
  }

  if (minuteStatus === "Borrador") {
    if (canEdit && !archived) {
      return (
        <Button asChild size="sm" className="bg-[#153b5c]">
          <Link href={editorUrl}><FilePenLine className="size-4" /> Editar acta de audiencia</Link>
        </Button>
      );
    }
    return canView ? (
      <Button asChild size="sm" variant="outline"><Link href={editorUrl}><FileText className="size-4" /> Ver borrador del acta</Link></Button>
    ) : (
      <Button size="sm" disabled title="No tiene permiso para consultar actas"><FileText className="size-4" /> Ver acta</Button>
    );
  }

  if (!canView) {
    return <Button size="sm" disabled title="No tiene permiso para consultar actas"><FileText className="size-4" /> Ver acta de audiencia</Button>;
  }

  if (minuteStatus === "Archivada") {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={editorUrl}><FileText className="size-4" /> Ver acta archivada</Link>
      </Button>
    );
  }

  const signed = minuteStatus === "Firmada";
  return (
    <>
      <Button asChild size="sm" variant="outline">
        <Link href={editorUrl}><FileText className="size-4" /> Ver acta de audiencia</Link>
      </Button>
      <Button asChild size="sm" className="bg-[#153b5c]">
        <a href={printUrl} target="_blank" rel="noreferrer">
          <Printer className="size-4" /> {signed ? "PDF/Imprimir acta firmada" : "Imprimir acta de audiencia"}
        </a>
      </Button>
    </>
  );
}
