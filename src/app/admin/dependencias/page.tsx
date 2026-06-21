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
import { Label } from "@/components/ui/label";
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
  const [canViewDependencies, canViewInstitutions, canCreate, canEdit, canManageInstitutions] = await Promise.all([
    can(profile, "view", "dependencias", { supabase }),
    can(profile, "view", "instituciones", { supabase }),
    canManageDependency(profile, "create", { supabase }),
    canManageDependency(profile, "edit", { supabase }),
    can(profile, "manage", "instituciones", { supabase }),
  ]);
  if (!canViewDependencies && !canViewInstitutions && !canCreate && !canEdit) redirect("/no-autorizado");
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
            className={`app-card-enter min-w-0 overflow-hidden rounded-lg border bg-white p-5 transition-shadow duration-200 hover:shadow-md ${dependency.archived_at ? "opacity-75" : ""}`}
          >
            <div className="flex flex-wrap justify-between gap-2">
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
            <h2 className="mt-4 break-words font-semibold">{dependency.name}</h2>
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
  const prefix=`dependency-${String(data?.id??"new")}`;
  return (
    <DraftForm action={saveDependency} storageKey={`sigj:dependency:${String(data?.id??"new")}`} className="mt-4 grid gap-3">
      <input type="hidden" name="id" value={String(data?.id ?? "")} />
      <DependencyField id={`${prefix}-name`} label="Nombre institucional *"><Input id={`${prefix}-name`} name="name" defaultValue={String(data?.name ?? "")} placeholder="Ej. Juzgado Primero Civil del Circuito" required /></DependencyField>
      <DependencyField id={`${prefix}-code`} label="Código *"><Input id={`${prefix}-code`} name="code" defaultValue={String(data?.code ?? "")} placeholder="Ej. J01CCTO" required /></DependencyField>
      <DependencyField id={`${prefix}-type`} label="Tipo de dependencia *"><Input id={`${prefix}-type`} name="type" defaultValue={String(data?.type ?? "")} placeholder="Juzgado, sala, secretaría…" required /></DependencyField>
      <DependencyField id={`${prefix}-parent`} label="Dependencia superior" helper="Determina dónde aparece este despacho dentro del árbol institucional.">
        <select id={`${prefix}-parent`} name="parent_id" defaultValue={String(data?.parent_id ?? defaultParentId ?? "")} className="h-9 w-full rounded-md border px-3">
          {allowRoot && <option value="">Sin superior (institución raíz)</option>}
          {dependencies.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.name)}</option>)}
        </select>
      </DependencyField>
      <DependencyField id={`${prefix}-competence`} label="Competencia *"><Textarea id={`${prefix}-competence`} name="competence" defaultValue={String(data?.competence ?? "")} placeholder="Describa brevemente los asuntos que conoce" required /></DependencyField>
      <DependencyField id={`${prefix}-jurisdiction`} label="Jurisdicción" helper="Distrito, circuito o territorio. Si queda vacío se asignará según el tipo institucional."><Input id={`${prefix}-jurisdiction`} name="jurisdiction" defaultValue={String(data?.jurisdiction ?? "")} placeholder={LOCAL_JURISDICTION_DEFAULT} /></DependencyField>
      <DependencyField id={`${prefix}-description`} label="Descripción pública"><Textarea id={`${prefix}-description`} name="description" defaultValue={String(data?.description ?? "")} placeholder="Descripción breve para el directorio institucional" /></DependencyField>
      <details className="rounded-md border bg-slate-50 p-4">
        <summary className="cursor-pointer font-medium">Opciones avanzadas</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <DependencyField id={`${prefix}-level`} label="Nivel jerárquico" helper="Profundidad de esta dependencia en el árbol institucional, entre 1 y 10."><Input id={`${prefix}-level`} name="level" type="number" min={1} max={10} placeholder="Ej. 1" defaultValue={String(data?.level ?? 1)} required /></DependencyField>
          <DependencyField id={`${prefix}-slug`} label="Identificador de ruta *" helper="Texto corto usado en enlaces internos; utilice letras, números y guiones."><Input id={`${prefix}-slug`} name="route_slug" defaultValue={String(data?.route_slug ?? "")} placeholder="juzgado-primero-civil" required /></DependencyField>
          <DependencyField id={`${prefix}-department`} label="Departamento *"><Input id={`${prefix}-department`} name="department" defaultValue={String(data?.department ?? "Valle del Cauca")} required /></DependencyField>
          <DependencyField id={`${prefix}-municipality`} label="Municipio o sede *"><Input id={`${prefix}-municipality`} name="municipality" defaultValue={String(data?.municipality ?? "Santiago de Cali")} required /></DependencyField>
          <DependencyField id={`${prefix}-active`} label="Estado"><select id={`${prefix}-active`} name="is_active" defaultValue={String(data?.is_active ?? true)} className="h-9 w-full rounded-md border px-3"><option value="true">Activa</option><option value="false">Inactiva</option></select></DependencyField>
          <DependencyField id={`${prefix}-visibility`} label="Visibilidad"><select id={`${prefix}-visibility`} name="public_visible" defaultValue={String(data?.public_visible ?? true)} className="h-9 w-full rounded-md border px-3"><option value="true">Visible en panel público</option><option value="false">Solo interna</option></select></DependencyField>
        </div>
      </details>
      <SubmitButton pendingLabel="Guardando…">Guardar dependencia</SubmitButton>
    </DraftForm>
  );
}

function DependencyField({id,label,helper,children}:{id:string;label:string;helper?:string;children:React.ReactNode}) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}{helper&&<p className="text-xs leading-5 text-muted-foreground">{helper}</p>}</div>;
}
