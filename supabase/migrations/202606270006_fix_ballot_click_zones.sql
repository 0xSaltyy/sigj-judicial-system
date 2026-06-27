update public.elections
set ballot_zones='{"left":{"x":2.9,"y":36.2,"w":29.9,"h":62.2},"center":{"x":35,"y":36.2,"w":29.8,"h":62.2},"right":{"x":66.9,"y":36.2,"w":29.8,"h":62.2}}'::jsonb
where slug='eleccion-gobernador-valle-del-cauca-2026';
notify pgrst,'reload schema';
