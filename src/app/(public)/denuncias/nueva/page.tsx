import Link from "next/link";
import { ShieldAlert, Search } from "lucide-react";
import { submitComplaint } from "@/app/actions/complaints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const metadata = { title: "Realizar denuncia" };

export default async function NewComplaintPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return (
    <div className="bg-[#f5f7f9]">
      <div className="mx-auto max-w-[980px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 border-l-4 border-[#b21b1b] bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#5b7287]">Canal público</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold text-[#112f4e]">Realizar denuncia</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700">
            Registre una denuncia institucional. Al enviarla recibirá un número de denuncia y un código privado para consultar el estado.
          </p>
          <Button asChild variant="outline" className="mt-5 rounded-none gap-2">
            <Link href="/denuncias/estado"><Search className="size-4" /> Consultar estado de una denuncia</Link>
          </Button>
        </div>

        {query.error ? <p className="mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-900">{query.error}</p> : null}

        <form action={submitComplaint} className="grid gap-6 border bg-white p-6 shadow-sm">
          <div className="flex gap-3 rounded-none border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <p>Los adjuntos quedan en almacenamiento privado. La consulta pública requiere el código privado, no muestra notas internas ni datos de revisión.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre del denunciante" name="complainant_name" placeholder="Opcional si marca anónima" />
            <Field label="Medio de contacto" name="contact_method" placeholder="Discord, Roblox, correo ficticio o usuario" />
            <Field label="Categoría" name="category" placeholder="Conducta, abuso, fraude, seguridad..." required />
            <Field label="Persona o entidad reportada" name="reported_subject" placeholder="Nombre visible o dependencia" />
            <Field label="Fecha aproximada" name="occurred_on" type="date" />
            <Field label="Lugar o canal" name="location" placeholder="Servidor, sala, ciudad, enlace..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descripción de los hechos</Label>
            <Textarea id="description" name="description" required minLength={20} className="min-h-44 rounded-none" placeholder="Explique de forma clara qué ocurrió, quiénes participaron y cualquier contexto relevante." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="evidence">Adjunto protegido</Label>
            <Input id="evidence" name="evidence" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" className="rounded-none" />
            <p className="text-xs text-slate-500">Máximo 10 MB. Tipos permitidos: PDF, PNG, JPG o TXT.</p>
          </div>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" name="anonymous" className="mt-1" />
            Presentar de forma anónima dentro del panel administrativo.
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" name="confirmation" required className="mt-1" />
            Confirmo que la información enviada es correcta y que conservaré el código privado de seguimiento.
          </label>
          <div className="flex flex-wrap gap-3 border-t pt-5">
            <Button type="submit" className="rounded-none bg-[#005ea8] hover:bg-[#1a4480]">Enviar denuncia</Button>
            <Button asChild type="button" variant="outline" className="rounded-none"><Link href="/denuncias/estado">Ya tengo un código</Link></Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, placeholder, type = "text", required = false }: { label: string; name: string; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} className="rounded-none" />
    </div>
  );
}
