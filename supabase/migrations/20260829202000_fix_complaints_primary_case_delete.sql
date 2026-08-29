alter table public.complaints
  drop constraint if exists complaints_primary_case_id_fkey;

alter table public.complaints
  add constraint complaints_primary_case_id_fkey
  foreign key (primary_case_id)
  references public.cases(id)
  on delete set null;
