-- El flujo formal exige que Secretaría pueda capturar su propia firma del acta.
-- Se mantienen separados los permisos del recurso acta y del mecanismo de firma.
update public.role_permission_rules
set allowed = true
where role in ('SECRETARIO_GENERAL','SECRETARIO_DESPACHO')
  and resource = 'firmas'
  and action = 'sign';

notify pgrst, 'reload schema';
