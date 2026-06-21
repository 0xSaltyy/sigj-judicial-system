"use client";

import { useEffect, useState } from "react";
import { FileText, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function SecurePdfPreview({url,title,className}:{url:string;title:string;className?:string}) {
  const [status,setStatus]=useState<"loading"|"loaded"|"unavailable">("loading");
  useEffect(()=>{setStatus("loading");const timer=window.setTimeout(()=>setStatus((current)=>current==="loading"?"unavailable":current),8000);return()=>window.clearTimeout(timer);},[url]);
  return <div className={cn("relative min-h-80 overflow-hidden bg-slate-100",className)}>
    <iframe src={url} title={title} className="h-full min-h-80 w-full border-0 bg-white" onLoad={()=>setStatus("loaded")}/>
    {status==="loading"&&<div className="absolute inset-0 grid place-items-center bg-slate-50/95 text-center"><div><LoaderCircle className="mx-auto size-8 animate-spin text-[#153553]"/><p className="mt-3 text-sm font-medium">Cargando vista previa segura…</p></div></div>}
    {status==="unavailable"&&<div className="absolute inset-x-4 bottom-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-950 shadow-sm"><FileText className="mr-1 inline size-4"/>La vista integrada tarda más de lo esperado. Use “Abrir en nueva pestaña” o “Descargar”.</div>}
  </div>;
}
