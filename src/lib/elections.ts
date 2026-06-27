export const ELECTION_STATUS_LABELS: Record<string,string> = {
  draft:"Borrador", prepared:"Preparada", open:"Abierta", suspended:"Suspendida", reopened:"Reabierta", closed:"Cerrada", scrutiny:"En escrutinio", preliminary_results:"Resultados preliminares", definitively_closed:"Cerrada definitivamente", final_results_published:"Resultados definitivos publicados", archived:"Archivada",
};
export const VOTE_STATUS_LABELS: Record<string,string> = {
  pending_validation:"Pendiente de validación", valid:"Válido", observed:"Observado", annulled:"Anulado", rejected:"Rechazado", duplicate:"Duplicado", cancelled:"Cancelado",
};
export const MANUAL_BATCH_STATUS_LABELS: Record<string,string> = {
  draft:"Borrador", submitted:"Enviado", pending_validation:"Pendiente de validación", validated:"Validado", rejected:"Rechazado", annulled:"Anulado",
};
export const BALLOT_ZONES = {
  left:{x:8,y:18,w:28,h:65},
  center:{x:36,y:18,w:28,h:65},
  right:{x:68,y:18,w:24,h:65},
} as const;
export function statusLabel(map:Record<string,string>, value:string|null|undefined){return map[value??""]??value??"Sin estado";}
export function slugifyElection(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90)||"eleccion";}
