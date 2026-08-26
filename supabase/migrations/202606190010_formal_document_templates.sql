-- Plantillas institucionales y metadatos formales para providencias.
-- No altera las políticas RLS ni los flujos de autenticación existentes.

alter table public.proceedings
  add column if not exists template_style text not null default 'auto',
  add column if not exists template_key text,
  add column if not exists document_metadata jsonb not null default '{}'::jsonb;

alter table public.proceedings
  drop constraint if exists proceedings_template_style_check;
alter table public.proceedings
  add constraint proceedings_template_style_check
  check (template_style in ('auto','corte_suprema','tribunal_superior','juzgado','blank'));

alter table public.proceedings
  drop constraint if exists proceedings_document_metadata_check;
alter table public.proceedings
  add constraint proceedings_document_metadata_check
  check (jsonb_typeof(document_metadata) = 'object');

drop view if exists public.public_proceedings;
create view public.public_proceedings with (security_barrier = true) as
select p.id,p.case_id,p.providence_number,p.title,p.type,p.chamber,p.content_markdown,p.published_at,
       c.internal_number,c.judicial_number,c.authority_type,c.claimant_name,c.defendant_name,c.municipality,
       d.name as dependency_name,p.creation_mode,p.providence_date,p.requires_signature,
       p.template_style,p.template_key,p.document_metadata
from public.proceedings p
join public.cases c on c.id=p.case_id
left join public.dependencies d on d.id=c.dependency_id
where p.status='Publicado' and p.visibility='public' and p.archived_at is null
  and c.archived_at is null and c.public_visibility and c.confidentiality_level='Público';

grant select on public.public_proceedings to anon,authenticated;
