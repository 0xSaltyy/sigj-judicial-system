import Link from "next/link";
import { headers } from "next/headers";
import { InstitutionalMark } from "@/components/institutional-mark";
import { isTechnicalPreviewHostname, requestHostname, siteUrl } from "@/lib/site-url";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const preview = requestHeaders.get("x-sigj-preview") === "1" ||
    isTechnicalPreviewHostname(requestHostname(requestHeaders));

  return <div className="grid min-h-screen bg-[#f2f5f7] lg:grid-cols-[1fr_520px]"><aside className="relative hidden overflow-hidden bg-[#102d49] p-12 text-white institutional-grid lg:flex lg:flex-col"><InstitutionalMark /><div className="my-auto max-w-lg"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d1b56f]">{preview ? "Vista previa técnica" : "Acceso seguro"}</p><h1 className="mt-4 text-4xl font-semibold leading-tight">Sistema Integral de<br />Gestión Judicial</h1><p className="mt-5 text-base leading-7 text-slate-300">{preview ? "Entorno técnico de demostración. El acceso con credenciales está reservado al dominio oficial." : "Área reservada para funcionarios y personal autorizado de las dependencias judiciales."}</p></div><p className="text-xs leading-5 text-slate-400">{preview ? "Vista previa técnica · Sin acceso con contraseña" : "Palacio Judicial · Administración del sistema"}</p></aside><main className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-sm"><div className="mb-8 lg:hidden"><div className="rounded bg-[#102d49] p-4"><InstitutionalMark /></div></div>{preview && <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950" role="alert"><p className="font-semibold">Esta es una vista previa técnica.</p><p>Para iniciar sesión use el dominio oficial: <a href={siteUrl("/login")} className="font-semibold underline underline-offset-2">https://palaciodejusticia.fyi</a></p></div>}{children}<p className="mt-8 text-center text-xs text-muted-foreground"><Link href="/" className="font-semibold text-[#153b5c]">Volver al portal público</Link></p><p className="mt-5 text-center text-[10px] leading-4 text-slate-500">Sistema ficticio de demostración académica. No corresponde a una autoridad judicial real ni produce efectos jurídicos.</p></div></main></div>;
}
