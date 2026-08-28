-- Professional DOJ roleplay warrant templates and server-side numbering.
-- Additive only: preserves existing roleplay_warrants rows, RLS, triggers and audit.

alter table public.roleplay_warrants add column if not exists case_number text;
alter table public.roleplay_warrants add column if not exists warrant_title text;
alter table public.roleplay_warrants add column if not exists court text;
alter table public.roleplay_warrants add column if not exists district text;
alter table public.roleplay_warrants add column if not exists division text;
alter table public.roleplay_warrants add column if not exists city_state text;
alter table public.roleplay_warrants add column if not exists applicant_name text;
alter table public.roleplay_warrants add column if not exists applicant_title text;
alter table public.roleplay_warrants add column if not exists applicant_agency text;
alter table public.roleplay_warrants add column if not exists attorney_name text;
alter table public.roleplay_warrants add column if not exists target_type text;
alter table public.roleplay_warrants add column if not exists document_data jsonb not null default '{}';
alter table public.roleplay_warrants add column if not exists version integer not null default 1;
alter table public.roleplay_warrants add column if not exists replaced_by uuid references public.roleplay_warrants(id);
alter table public.roleplay_warrants add column if not exists returned_at timestamptz;
alter table public.roleplay_warrants add column if not exists inventory jsonb not null default '[]';

create table if not exists public.roleplay_warrant_number_sequences (
  type_key text primary key,
  last_value integer not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.next_roleplay_warrant_number(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
begin
  v_prefix := case p_type
    when 'search_seizure' then 'RP-SW'
    when 'arrest' then 'RP-AW'
    when 'bench' then 'RP-BW'
    when 'electronic_data' then 'RP-EDW'
    when 'tracking_device' then 'RP-TDW'
    when 'stored_communications' then 'RP-SCW'
    when 'property_seizure' then 'RP-PSW'
    when 'inspection' then 'RP-IW'
    when 'material_witness' then 'RP-MWW'
    when 'custom' then 'RP-CW'
    else 'RP-WR'
  end;

  insert into public.roleplay_warrant_number_sequences(type_key, last_value)
  values (p_type, 1)
  on conflict (type_key) do update
    set last_value = public.roleplay_warrant_number_sequences.last_value + 1,
        updated_at = now()
  returning last_value into v_next;

  return v_prefix || '-' || extract(year from now())::int || '-' || lpad(v_next::text, 6, '0');
end;
$$;

create index if not exists roleplay_warrants_type_status_idx on public.roleplay_warrants(warrant_type, status);
create index if not exists roleplay_warrants_document_data_gin on public.roleplay_warrants using gin(document_data);
