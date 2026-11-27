-- 0007 : épinglage des publications, suppression de réseau
alter table public.posts add column if not exists pinned boolean not null default false;
create index if not exists komya_posts_pinned_idx on public.posts(pinned desc, created_at desc) where deleted_at is null;

-- Épingler / désépingler : responsable ou modérateur du réseau, ou équipe KOMYA
create or replace function public.komya_toggle_pin(p_pid uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_nid uuid;
  v_ok boolean := false;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select network_id into v_nid from public.posts where id = p_pid;
  if v_nid is not null then
    perform 1 from public.network_members
      where network_id = v_nid and user_id = v_uid and status = 'active'
        and role in ('owner','moderator');
    v_ok := found;
  end if;
  if not v_ok then
    perform 1 from public.user_roles where user_id = v_uid and role in ('admin','moderator');
    v_ok := found;
  end if;
  if not v_ok then raise exception 'Non autorisé à épingler cette publication'; end if;
  update public.posts set pinned = not pinned where id = p_pid;
end $$;

-- Supprimer un réseau : responsable uniquement ; supprime publications et membres
create or replace function public.komya_delete_network(p_nid uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  perform 1 from public.network_members
    where network_id = p_nid and user_id = v_uid and role = 'owner' and status = 'active';
  if not found then raise exception 'Seul le responsable du réseau peut le supprimer'; end if;
  begin
    delete from public.post_attachments where post_id in (select id from public.posts where network_id = p_nid);
  exception when undefined_table then null;
  end;
  begin
    delete from public.attachments where post_id in (select id from public.posts where network_id = p_nid);
  exception when undefined_table then null;
  end;
  delete from public.comments where post_id in (select id from public.posts where network_id = p_nid);
  delete from public.reactions where post_id in (select id from public.posts where network_id = p_nid);
  delete from public.posts where network_id = p_nid;
  delete from public.network_members where network_id = p_nid;
  delete from public.networks where id = p_nid;
end $$;
