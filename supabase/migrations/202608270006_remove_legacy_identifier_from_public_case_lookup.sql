-- DOJ Roleplay · Public federal Case lookup cleanup.
-- Replaces the public view without exposing legacy Colombian/radicado-style identifiers.

drop view if exists public.public_case_lookup;

create view public.public_case_lookup with (security_barrier = true) as
select
  c.id,
  coalesce(c.case_number, c.internal_number) as case_number,
  c.internal_number,
  c.docket_number,
  c.docket_court,
  c.docket_district,
  c.docket_division,
  c.docket_assigned_at,
  c.filing_status,
  c.title,
  c.summary,
  coalesce(c.case_caption, c.title) as case_caption,
  fc.official_name as court_name,
  fc.abbreviation as court_abbreviation,
  c.case_category,
  c.status,
  c.filed_at,
  c.federal_access_level,
  d.name as institution_name
from public.cases c
left join public.dependencies d on d.id = c.dependency_id
left join public.federal_courts fc on fc.id = c.court_id
where c.public_visibility
  and c.confidentiality_level = 'Público'
  and c.federal_access_level = 'Public'
  and coalesce(c.sealed, false) = false
  and coalesce(c.grand_jury_restricted, false) = false
  and c.archived_at is null;

grant select on public.public_case_lookup to anon, authenticated;

notify pgrst, 'reload schema';
