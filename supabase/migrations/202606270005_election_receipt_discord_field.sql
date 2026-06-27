drop function if exists public.lookup_election_receipt(text,text);
create function public.lookup_election_receipt(p_receipt_code text,p_discord text)
returns table(election_title text,receipt_code text,submitted_at timestamptz,status text,public_message text,discord_username text)
language sql stable security definer set search_path=public as $$
  select e.title::text,v.receipt_code::text,v.submitted_at,v.status::text,
    case v.status when 'pending_validation' then 'Su voto fue recibido y está pendiente de validación.'
      when 'valid' then 'Su voto fue validado.'
      when 'observed' then 'Su voto se encuentra en revisión.'
      when 'annulled' then 'Su voto fue anulado por decisión autorizada.'
      when 'rejected' then 'Su voto fue rechazado.'
      when 'duplicate' then 'Su voto fue marcado como posible duplicado.'
      else 'Su voto no se encuentra activo.' end,
    v.discord_username::text
  from public.election_votes v join public.elections e on e.id=v.election_id
  where upper(v.receipt_code)=upper(trim(coalesce(p_receipt_code,'')))
    and v.discord_normalized=lower(regexp_replace(trim(coalesce(p_discord,'')),'\s+','','g'))
  limit 1
$$;
grant execute on function public.lookup_election_receipt(text,text) to anon,authenticated;
notify pgrst,'reload schema';
