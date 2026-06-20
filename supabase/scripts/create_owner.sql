-- Ejecutar únicamente desde Supabase SQL Editor después de crear el usuario en Authentication.
-- Sustituya el placeholder en la sesión privada; no publique el correo real en el repositorio.
select public.bootstrap_system_owner(
  'owner@example.com',
  'Lilith D''Amico'
);
