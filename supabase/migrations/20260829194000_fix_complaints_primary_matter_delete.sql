-- Allow authorized DOJ Matter deletion without leaving complaints blocked by
-- their primary Matter reference. The complaint is preserved and its primary
-- Matter pointer is cleared automatically by PostgreSQL.

alter table public.complaints
  drop constraint if exists complaints_primary_matter_id_fkey;

alter table public.complaints
  add constraint complaints_primary_matter_id_fkey
  foreign key (primary_matter_id)
  references public.matters(id)
  on delete set null;

notify pgrst, 'reload schema';

