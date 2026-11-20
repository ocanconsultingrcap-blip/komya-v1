-- KOMYA 0003 : adhésion à un réseau par RPC (permet de rejoindre après avoir quitté ; refuse les membres retirés/refusés).
create or replace function public.komya_join_network(nid uuid) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare n public.networks; m public.network_members; st text;
begin
 if auth.uid() is null or not public.komya_active() then raise exception 'Non autorisé'; end if;
 select * into n from public.networks where id=nid;
 if not found then raise exception 'Réseau introuvable'; end if;
 st:=case when n.visibility='public' then 'active' else 'pending' end;
 select * into m from public.network_members where network_id=nid and user_id=auth.uid();
 if found then
  if m.status in ('removed','rejected') then raise exception 'Adhésion impossible'; end if;
  if m.status='active' then return 'active'; end if;
  update public.network_members set status=st,role='member' where network_id=nid and user_id=auth.uid();
 else
  insert into public.network_members(network_id,user_id,role,status) values(nid,auth.uid(),'member',st);
 end if;
 return st;
end;$$;
revoke all on function public.komya_join_network(uuid) from public, anon;
grant execute on function public.komya_join_network(uuid) to authenticated;
