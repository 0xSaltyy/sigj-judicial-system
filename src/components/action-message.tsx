export function ActionMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return <p role="status" className={`mb-5 rounded border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ?? success}</p>;
}
