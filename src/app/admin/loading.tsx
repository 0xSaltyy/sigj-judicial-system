export default function AdminLoading() {
  return <AdminLoadingShell />;
}

function AdminLoadingShell() {
  // Kept local to avoid turning the app/loading boundary into a client component.
  // The visual shell mirrors heavy admin pages: header, metrics, filters and rows.
  return <div className="space-y-5" aria-label="Cargando módulo"><div className="space-y-2"><div className="h-8 w-72 max-w-full animate-pulse rounded bg-slate-200"/><div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100"/></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4}).map((_,index)=><div key={index} className="h-32 animate-pulse rounded-xl bg-slate-100"/>)}</div><div className="h-20 animate-pulse rounded-xl bg-slate-100"/><div className="space-y-3 rounded-xl border bg-white p-4">{Array.from({length:6}).map((_,index)=><div key={index} className="h-14 animate-pulse rounded bg-slate-100"/>)}</div></div>;
}
