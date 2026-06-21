-- Corrige únicamente defaults históricos conocidos; conserva valores personalizados.
alter table public.dependencies alter column jurisdiction drop default;
alter table public.dependencies alter column department set default 'Valle del Cauca';
alter table public.dependencies alter column municipality set default 'Santiago de Cali';
alter table public.cases alter column department set default 'Valle del Cauca';
alter table public.cases alter column municipality set default 'Santiago de Cali';
update public.dependencies set jurisdiction='Circuitos judiciales del Valle del Cauca'
where jurisdiction in ('Circuitos judiciales de Bogotá','Circuitos judiciales simulados')
  and (lower(type) like '%juzgado%' or lower(name) like '%juzgado%' or lower(name) like '%despacho%');
update public.dependencies set jurisdiction='Jurisdicción nacional'
where coalesce(nullif(trim(jurisdiction),''),'') in ('','Ámbito nacional','Ámbito demostrativo nacional')
  and (lower(type) like '%corte%' or lower(name) like '%corte suprema%');
update public.dependencies set jurisdiction='Distrito judicial correspondiente'
where coalesce(nullif(trim(jurisdiction),''),'') in ('','Distrito Judicial Simulado','Distrito Judicial de Bogotá')
  and (lower(type) like '%tribunal%' or lower(name) like '%tribunal superior%');
notify pgrst,'reload schema';
