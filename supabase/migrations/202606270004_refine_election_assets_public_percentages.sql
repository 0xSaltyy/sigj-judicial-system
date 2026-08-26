alter table public.elections
  add column if not exists total_expected_votes integer not null default 100 check(total_expected_votes between 1 and 100000000);

update public.elections
set ballot_image_path='/VOTACIONES/Carta de Votacion 2.png',
    total_expected_votes=greatest(coalesce(total_expected_votes,100),100),
    ballot_zones='{"left":{"x":5.5,"y":16.5,"w":30,"h":70},"center":{"x":35,"y":16.5,"w":30,"h":70},"right":{"x":65,"y":16.5,"w":29.5,"h":70}}'::jsonb
where slug='eleccion-gobernador-valle-del-cauca-2026';

update public.election_options o
set candidate_image_path='/VOTACIONES/Candidato 2.2 .png',
    ballot_card_image_path='/VOTACIONES/Candidato 2.2 .png'
from public.elections e
where o.election_id=e.id
  and e.slug='eleccion-gobernador-valle-del-cauca-2026'
  and o.option_number=2;

create or replace view public.public_elections with (security_barrier=true) as
select e.id,e.slug,e.title,e.office,e.territory,e.period,e.round_label,e.status,e.opens_at,e.closes_at,e.description,e.instructions,e.ballot_image_path,e.ballot_zones,d.name institution_name,e.total_expected_votes
from public.elections e left join public.dependencies d on d.id=e.institution_id
where e.status in ('prepared','open','reopened','closed','scrutiny','preliminary_results','definitively_closed','final_results_published');
grant select on public.public_elections to anon,authenticated;

create or replace function public.election_public_percentage_totals(p_election_id uuid)
returns table(option_id uuid,candidate_name text,is_blank_vote boolean,display_order integer,card_label text,ballot_card_image_path text,candidate_image_path text,public_percent numeric,progress_percent numeric,results_updated_at timestamptz)
language sql stable security definer set search_path=public as $$
  with totals as (
    select * from public.election_public_totals(p_election_id)
  ), election as (
    select id,total_expected_votes,coalesce(results_published_at,updated_at,created_at) as updated_at
    from public.elections where id=p_election_id and status in ('preliminary_results','definitively_closed','final_results_published')
  ), sum_total as (
    select coalesce(sum(total_valid),0)::numeric as counted from totals
  )
  select o.id,o.candidate_name::text,o.is_blank_vote,o.display_order,
    ('Tarjeta Electoral '||o.display_order)::text,
    o.ballot_card_image_path::text,o.candidate_image_path::text,
    round((coalesce(t.total_valid,0)::numeric / greatest(e.total_expected_votes,1)::numeric) * 100, 2),
    round((s.counted / greatest(e.total_expected_votes,1)::numeric) * 100, 2),
    e.updated_at
  from election e
  join public.election_options o on o.election_id=e.id and o.active
  left join totals t on t.option_id=o.id
  cross join sum_total s
  order by o.display_order
$$;

grant execute on function public.election_public_percentage_totals(uuid) to anon,authenticated;
notify pgrst,'reload schema';
