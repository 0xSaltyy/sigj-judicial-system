import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function UnauthorizedPage() { return <div className="mx-auto grid min-h-[560px] max-w-xl place-items-center px-4 text-center"><div><div className="mx-auto grid size-16 place-items-center rounded-full bg-red-50 text-red-700"><ShieldX className="size-8" /></div><h1 className="mt-6 text-3xl font-semibold text-[#102d49]">Acceso no autorizado</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Su perfil no tiene permisos para consultar este recurso. Si considera que es un error, contacte al administrador del sistema.</p><Button asChild className="mt-6 bg-[#153b5c]"><Link href="/login">Volver al acceso institucional</Link></Button></div></div>; }
