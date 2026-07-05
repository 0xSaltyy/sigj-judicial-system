drop function if exists public.submit_online_vote(uuid,uuid,text,text,text,text,text);

notify pgrst, 'reload schema';
