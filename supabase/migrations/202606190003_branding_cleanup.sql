-- Normaliza la identidad institucional y el contenido inicial visible.

alter table public.dependencies alter column department set default 'Bogotá D.C.';
alter table public.dependencies alter column municipality set default 'Bogotá D.C.';

update public.dependencies
set department = 'Bogotá D.C.', municipality = 'Bogotá D.C.';

update public.dependencies
set competence = case code
    when 'PJ' then 'Coordinación tecnológica y administrativa del sistema.'
    when 'CSJ' then 'Casación, revisión, tutelas contra providencias y conflictos de competencia.'
    else competence
  end,
  jurisdiction = case
    when code in ('PJ', 'CSJ') then 'Ámbito nacional'
    when code in ('TSJ', 'SC', 'SP', 'SL', 'SF', 'SCT') then 'Distrito Judicial de Bogotá'
    when code = 'JC' then 'Circuitos judiciales de Bogotá'
    when code = 'JM' then 'Municipios del Distrito Judicial'
    when code = 'RAD' then 'Ventanilla única judicial'
    when code = 'REP' then 'Jurisdicciones habilitadas'
    when code = 'ARJ' then 'Archivo central judicial'
    when code = 'GOB-COM' then 'Ámbito institucional externo'
    else jurisdiction
  end;

update public.cases as c
set title = v.title,
    claimant_name = v.claimant_name,
    defendant_name = v.defendant_name,
    summary = v.summary,
    claims = v.claims,
    department = 'Bogotá D.C.',
    municipality = 'Bogotá D.C.'
from (values
  ('20000000-0000-0000-0000-000000000001'::uuid, 'Revisión constitucional', 'Parte solicitante', 'Autoridad accionada', 'Revisión constitucional remitida para estudio.', 'Resolver el asunto sometido a revisión.'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'Apelación civil', 'Parte apelante', 'Parte convocada', 'Controversia contractual en segunda instancia.', 'Resolver el recurso de apelación.'),
  ('20000000-0000-0000-0000-000000000003'::uuid, 'Proceso ordinario de circuito', 'Parte demandante', 'Parte demandada', 'Proceso ordinario asignado al circuito judicial.', 'Resolver las pretensiones presentadas.'),
  ('20000000-0000-0000-0000-000000000004'::uuid, 'Pequeña causa municipal', 'Parte solicitante', 'Parte convocada', 'Asunto de mínima cuantía en trámite.', 'Adoptar la decisión correspondiente.')
) as v(id, title, claimant_name, defendant_name, summary, claims)
where c.id = v.id;

update public.case_actions
set description = case id
  when '30000000-0000-0000-0000-000000000001'::uuid then 'Se avoca conocimiento y se ordena comunicar a las partes.'
  when '30000000-0000-0000-0000-000000000002'::uuid then 'Se incorporan los documentos aportados oportunamente.'
  when '30000000-0000-0000-0000-000000000003'::uuid then 'Se fija fecha y hora para audiencia pública.'
  else description
end
where id in (
  '30000000-0000-0000-0000-000000000001'::uuid,
  '30000000-0000-0000-0000-000000000002'::uuid,
  '30000000-0000-0000-0000-000000000003'::uuid
);

update public.proceedings
set content_markdown = '# Auto de avocamiento\n\nSe avoca conocimiento del asunto y se ordena comunicar esta decisión.'
where id = '50000000-0000-0000-0000-000000000001'::uuid;

update public.public_notices
set content_markdown = '# Jornada de servicios digitales\n\nConsulte los horarios y canales habilitados para la atención institucional.'
where id = '60000000-0000-0000-0000-000000000001'::uuid;

update public.public_notices
set title = 'Orientaciones para el acceso a servicios institucionales',
    slug = 'orientaciones-servicios-institucionales',
    content_markdown = '# Orientaciones de servicio\n\nConsulte los canales oficiales de atención y las recomendaciones de acceso.'
where id = '60000000-0000-0000-0000-000000000002'::uuid;

update public.system_settings
set value = value - 'demo', updated_at = now()
where key = 'institution';
