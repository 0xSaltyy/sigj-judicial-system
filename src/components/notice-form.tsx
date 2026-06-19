import { saveNotice } from "@/app/actions/notices";
import { DocumentUploader } from "@/components/document-uploader";
import { DraftForm } from "@/components/draft-form";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
type Notice = { id: string; title: string; category: string; issuing_entity: string; excerpt: string | null; content_markdown: string; status: string };
export function NoticeForm({ notice }: { notice?: Notice }) { return <DraftForm action={saveNotice} storageKey={`sigj:notice:${notice?.id ?? "new"}`} className="space-y-5">{notice && <input type="hidden" name="id" value={notice.id} />}<div className="grid gap-5 rounded-lg border bg-white p-6 md:grid-cols-2"><Field label="Título *"><Input name="title" defaultValue={notice?.title} required /></Field><Field label="Categoría *"><Input name="category" defaultValue={notice?.category} required /></Field><Field label="Entidad emisora *"><Input name="issuing_entity" defaultValue={notice?.issuing_entity} required /></Field><Field label="Estado"><select name="status" defaultValue={notice?.status ?? "Borrador"} className="h-9 rounded-md border px-3"><option>Borrador</option><option>Publicado</option></select></Field><div className="md:col-span-2"><Field label="Resumen *"><Textarea name="excerpt" defaultValue={notice?.excerpt ?? ""} required /></Field></div></div><div className="rounded-lg border bg-white p-6"><DocumentUploader name="image" multiple={false} accept=".png,.jpg,.jpeg" label="Imagen del comunicado (opcional)" /></div><div className="rounded-lg border bg-white p-6"><Label className="mb-3 block">Contenido *</Label><MarkdownEditor initialValue={notice?.content_markdown ?? "# Comunicado\n\nContenido institucional."} /></div><SubmitButton pendingLabel="Guardando…">Guardar comunicado</SubmitButton></DraftForm>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div>; }
