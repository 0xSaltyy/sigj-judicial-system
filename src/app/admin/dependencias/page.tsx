import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { saveDependency } from "@/app/actions/dependencies";
import { AdminPageHeader } from "@/components/admin-page";
import { ActionMessage } from "@/components/action-message";
import { LifecycleActions } from "@/components/lifecycle-actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DraftForm } from "@/components/draft-form";
import { can, canManageDependency } from "@/lib/auth/permissions";
import { requireInternalUser } from "@/lib/auth/authorization";
import { defaultJurisdiction, LOCAL_JURISDICTION_DEFAULT } from "@/lib/institutional-language";

type DependencyRow = { id:string; parent_id:string|null; name:string; code:string; type:string; competence:string; jurisdiction:string|null; municipality:string|null; is_active:boolean; archived_at:string|null; [key:string]:unknown };
function within(child:string|null,parent:string|null,rows:DependencyRow[]){if(!child||!parent)return false;const map=new Map(rows.map((item)=>[item.id,item]));let item=map.get(child);const seen=new Set<string>();while(item&&!seen.has(item.id)){if(item.id===parent)return true;seen.add(item.id);item=item.parent_id?map.get(item.parent_id):undefined;}return false;}

export default async function DependenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const [{ supabase, profile }, query] = await Promise.all([
    requireInternalUser(),
    searchParams,
  ]);
  const [canView, canCreate, canEdit, canManageInstitutions] = await Promise.all([
    can(profile, "view", "dependencias", { supabase }),
    canManageDependency(profile, "create", { supabase }),
    canManageDependency(profile, "edit", { supabase }),
    can(profile, "manage", "instituciones", { supabase }),
  ]);
  if (!canView && !canCreate && !canEdit) redirect("/no-autorizado");
  const { data, error } = await supabase
    .from("dependencies")
    .select("*")
    .order("name");
  const allRows=(data??[]) as DependencyRow[];
  const scopeRoot=profile.institution_id||profile.dependency_id;
  const globalScope=profile.is_owner||profile.role==="SUPER_ADMIN";
  const hasManagementScope=globalScope||Boolean(scopeRoot);
  const showCreate=canCreate&&hasManagementScope;
  const visibleRows=globalScope?allRows:allRows.filter((item)=>within(item.id,scopeRoot,allRows));
  return (
    <>
      <AdminPageHeader
        title="Instituciones y competencias"
        description="Estructura utilizada por usuarios y expedientes."
      />
      <ActionMessage
        error={query.error ?? (error ? "No fue posible cargar la estructura institucional." : undefined)}
        success={query.success}
      />
      {showCreate ? <details className="mb-5 rounded-lg border bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          Crear dependencia
        </summary>
        <DependencyForm dependencies={visibleRows} allowRoot={globalScope} defaultParentId={globalScope ? null : scopeRoot} />
      </details> : <p className="mb-5 rounded-lg border bg-white p-4 text-sm text-muted-foreground">{canCreate && !hasManagementScope ? "Su perfil no tiene alcance institucional suficiente." : canEdit ? "Puede editar las dependencias autorizadas, pero no tiene permiso para crear dependencias." : "Puede consultar la estructura y sus miembros. No tiene permiso para crear ni editar dependencias."}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleRows.map((dependency) => (
          <article
            key={dependency.id}
            className={`rounded-lg border bg-white p-5 ${dependency.archived_at ? "opacity-75" : ""}`}
          >
            <div className="flex justify-between">
              <Building2 className="size-5" />
              <div className="flex gap-2">
                <Badge variant="outline">{dependency.code}</Badge>
                <Badge>
                  {dependency.archived_at
                    ? "Archivada"
                    : dependency.is_active
                      ? "Activa"
                      : "Inactiva"}
                </Badge>
              </div>
            </div>
            <h2 className="mt-4 font-semibold">{dependency.name}</h2>
            <Link href={`/admin/dependencias/${dependency.id}`} className="mt-2 inline-block text-xs font-semibold text-[#153b5c] hover:underline">Abrir panel · miembros y actividad</Link>
            <p className="mt-2 text-xs text-muted-foreground">
              {dependency.competence}
            </p>
            <p className="mt-2 text-xs text-muted-foreground"><strong>Jurisdicción:</strong> {dependency.jurisdiction || defaultJurisdiction(dependency.type, dependency.name)}</p>
            <p className="mt-1 text-xs text-muted-foreground"><strong>Ciudad / sede:</strong> {dependency.municipality || "Sin definir"}</p>
            {canEdit && !dependency.archived_at && (globalScope || dependency.id !== profile.institution_id || canManageInstitutions) && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold">
                  Editar
                </summary>
                <DependencyForm data={dependency} dependencies={visibleRows.filter((item) => item.id !== dependency.id)} allowRoot={globalScope} defaultParentId={scopeRoot} />
              </details>
            )}
            {globalScope && <div className="mt-4">
              <LifecycleActions
                resource="dependencies"
                recordId={dependency.id}
                recordLabel={dependency.name}
                destination="/admin/dependencias"
                archived={Boolean(dependency.archived_at)}
                canArchive={profile.is_owner}
                canRestore={profile.is_owner}
                canHardDelete={profile.is_owner}
                compact
              />
            </div>}
          </article>
        ))}
      </div>
    </>
  );
}

function DependencyForm({ data, dependencies, allowRoot, defaultParentId }: { data?: Record<string, unknown>; dependencies: Array<Record<string, unknown>>; allowRoot: boolean; defaultParentId: string | null }) {
  return (
    <DraftForm action={saveDependency} storageKey={`sigj:dependency:${String(data?.id??"new")}`} className="mt-4 grid gap-3">
      <input type="hidden" name="id" value={String(data?.id ?? "")} />
      <Input
        name="name"
        defaultValue={String(data?.name ?? "")}
        placeholder="Nombre *"
        required
      />
      <Input
        name="code"
        defaultValue={String(data?.code ?? "")}
        placeholder="Código *"
        required
      />
      <Input
        name="type"
        defaultValue={String(data?.type ?? "")}
        placeholder="Tipo *"
        required
      />
      <select name="parent_id" defaultValue={String(data?.parent_id ?? defaultParentId ?? "")} className="h-9 rounded-md border px-3">
        {allowRoot && <option value="">Sin superior (institución raíz)</option>}
        {dependencies.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.name)}</option>)}
      </select>
      <Input name="level" type="number" min={1} max={10} defaultValue={String(data?.level ?? 1)} required />
      <Textarea name="description" defaultValue={String(data?.description ?? "")} placeholder="Descripción pública" />
      <Textarea
        name="competence"
        defaultValue={String(data?.competence ?? "")}
        placeholder="Competencia *"
        required
      />
      <Input
        name="jurisdiction"
        defaultValue={String(data?.jurisdiction ?? "")}
        placeholder={LOCAL_JURISDICTION_DEFAULT}
      />
      <p className="-mt-2 text-xs text-muted-foreground">Distrito / Circuito / Territorio. Si queda vacío, se asigna el valor correspondiente al tipo de institución.</p>
      <Input
        name="route_slug"
        defaultValue={String(data?.route_slug ?? "")}
        placeholder="slug-ruta *"
        required
      />
      <Input
        name="department"
        defaultValue={String(data?.department ?? "Valle del Cauca")}
        required
      />
      <Input
        name="municipality"
        defaultValue={String(data?.municipality ?? "Santiago de Cali")}
        required
      />
      <select
        name="is_active"
        defaultValue={String(data?.is_active ?? true)}
        className="h-9 rounded-md border px-3"
      >
        <option value="true">Activa</option>
        <option value="false">Inactiva</option>
      </select>
      <select name="public_visible" defaultValue={String(data?.public_visible ?? true)} className="h-9 rounded-md border px-3"><option value="true">Visible en panel público</option><option value="false">Solo interna</option></select>
      <SubmitButton pendingLabel="Guardando…">Guardar dependencia</SubmitButton>
    </DraftForm>
  );
}
