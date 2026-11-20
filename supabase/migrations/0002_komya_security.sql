-- KOMYA 0002 : correctifs RLS, RPC sécurisées, invitations, notifications, stockage, administration.
-- À exécuter APRÈS 0001 sur le NOUVEAU projet Supabase de production.

-- ===== Colonnes / tables complémentaires =====
alter table public.profiles add column if not exists suspended_at timestamptz;
create table if not exists public.audit_events(
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id) on delete set null,
 action text not null, entity_type text, entity_id uuid, meta jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.network_invitations(
 id uuid primary key default gen_random_uuid(), network_id uuid not null references public.networks(id) on delete cascade,
 invited_user_id uuid not null references public.profiles(id) on delete cascade, invited_by uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined','revoked')),
 created_at timestamptz not null default now(), unique(network_id,invited_user_id));
alter table public.audit_events enable row level security;
alter table public.network_invitations enable row level security;
create index if not exists komya_audit_idx on public.audit_events(created_at desc);
create index if not exists komya_invitations_user_idx on public.network_invitations(invited_user_id,status);

-- ===== Fonctions utilitaires =====
create or replace function public.komya_active() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.profiles where id=auth.uid() and suspended_at is null);
$$;
create or replace function public.komya_network_role(nid uuid) returns text language sql stable security definer set search_path=public,pg_temp as $$
 select role from public.network_members where network_id=nid and user_id=auth.uid() and status='active';
$$;
create or replace function public.komya_blocked_between(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create or replace function public.komya_conversation_blocked(cid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.conversation_members x join public.conversation_members y on y.conversation_id=x.conversation_id and y.user_id<>x.user_id
  where x.conversation_id=cid and x.user_id=auth.uid() and public.komya_blocked_between(x.user_id,y.user_id));
$$;
create or replace function public.komya_audit(act text,etype text,eid uuid,m jsonb default '{}') returns void language sql security definer set search_path=public,pg_temp as $$
 insert into public.audit_events(actor_id,action,entity_type,entity_id,meta) values(auth.uid(),act,etype,eid,coalesce(m,'{}'::jsonb));
$$;
create or replace function public.komya_notify(uid uuid,aid uuid,k text,et text,eid uuid,t text,b text default null) returns void language sql security definer set search_path=public,pg_temp as $$
 insert into public.notifications(user_id,actor_id,kind,entity_type,entity_id,title,body) select uid,aid,k,et,eid,t,b where uid is not null and uid is distinct from aid;
$$;

-- ===== Droits de colonnes : plus de modification libre des champs sensibles =====
revoke update on public.profiles,public.posts,public.comments,public.offers,public.notifications,public.reports,public.networks from authenticated;
grant update(display_name,country,city,sector,member_type,business_name,bio,avatar_url,updated_at) on public.profiles to authenticated;
grant update(body,image_path,deleted_at,updated_at) on public.posts to authenticated;
grant update(body,deleted_at) on public.comments to authenticated;
grant update(title,description,offer_type,category,price_amount,currency,country,city,image_path,status,expires_at) on public.offers to authenticated;
grant update(name,description,visibility) on public.networks to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant update(status) on public.reports to authenticated;

-- ===== Réécriture des politiques =====
-- Insertions : comptes suspendus exclus
drop policy if exists komya_posts_insert on public.posts;
create policy komya_posts_insert on public.posts for insert to authenticated with check(author_id=auth.uid() and public.komya_active());
drop policy if exists komya_comments_insert on public.comments;
create policy komya_comments_insert on public.comments for insert to authenticated with check(author_id=auth.uid() and public.komya_active());
drop policy if exists komya_offers_insert on public.offers;
create policy komya_offers_insert on public.offers for insert to authenticated with check(author_id=auth.uid() and public.komya_active());
drop policy if exists komya_networks_insert on public.networks;
create policy komya_networks_insert on public.networks for insert to authenticated with check(owner_id=auth.uid() and public.komya_active());
drop policy if exists komya_network_posts_insert on public.network_posts;
create policy komya_network_posts_insert on public.network_posts for insert to authenticated with check(author_id=auth.uid() and public.komya_active() and public.komya_is_network_member(network_id));

-- Réseaux : adhésion uniquement comme simple membre ; gestion corrigée (alias qualifié)
drop policy if exists komya_network_members_insert on public.network_members;
create policy komya_network_members_insert on public.network_members for insert to authenticated with check(
 user_id=auth.uid() and role='member' and public.komya_active() and exists(select 1 from public.networks n where n.id=network_id and ((n.visibility='public' and status='active') or (n.visibility='private' and status='pending'))));
drop policy if exists komya_network_members_manage on public.network_members;
create policy komya_network_members_manage on public.network_members for update to authenticated
 using(public.komya_is_staff() or public.komya_network_role(network_members.network_id) in ('owner','moderator'))
 with check(public.komya_is_staff() or public.komya_network_role(network_members.network_id)='owner' or (public.komya_network_role(network_members.network_id)='moderator' and role='member'));
create or replace function public.komya_network_owner_member() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin insert into public.network_members(network_id,user_id,role,status) values(new.id,new.owner_id,'owner','active') on conflict do nothing; return new; end;$$;
drop trigger if exists komya_network_owner on public.networks;
create trigger komya_network_owner after insert on public.networks for each row execute procedure public.komya_network_owner_member();
create or replace function public.komya_network_join_notify() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin if new.status='pending' then
 perform public.komya_notify(m.user_id,new.user_id,'network_request','network',new.network_id,'Nouvelle demande d''adhésion') from public.network_members m where m.network_id=new.network_id and m.role in ('owner','moderator') and m.status='active';
end if; return new; end;$$;
drop trigger if exists komya_network_join on public.network_members;
create trigger komya_network_join after insert on public.network_members for each row execute procedure public.komya_network_join_notify();

-- Défis : plus d'écriture directe par les participants (auto-validation impossible)
drop policy if exists komya_participants_insert on public.challenge_participants;
drop policy if exists komya_participants_update on public.challenge_participants;

-- Messagerie : création et lecture par RPC uniquement
drop policy if exists komya_conversations_insert on public.conversations;
drop policy if exists komya_conv_members_insert on public.conversation_members;
drop policy if exists komya_messages_manage on public.messages;
drop policy if exists komya_messages_insert on public.messages;
create policy komya_messages_insert on public.messages for insert to authenticated with check(
 sender_id=auth.uid() and public.komya_active() and public.komya_is_conversation_member(conversation_id) and not public.komya_conversation_blocked(conversation_id));
drop policy if exists komya_messages_read on public.messages;
create policy komya_messages_read on public.messages for select to authenticated using(deleted_at is null and public.komya_is_conversation_member(conversation_id));

-- Notifications : lecture/marquage/suppression des siennes ; création par triggers/RPC
drop policy if exists komya_notifications_self on public.notifications;
create policy komya_notifications_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy komya_notifications_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy komya_notifications_delete on public.notifications for delete to authenticated using(user_id=auth.uid());

-- Signalements : traitement par le staff
drop policy if exists komya_reports_update on public.reports;
create policy komya_reports_update on public.reports for update to authenticated using(public.komya_is_staff()) with check(public.komya_is_staff());

-- Rôles : lecture seule via l'API, écriture via RPC admin
drop policy if exists komya_roles_admin on public.user_roles;
revoke insert,update,delete on public.user_roles from authenticated;
-- Audit et invitations
create policy komya_audit_read on public.audit_events for select to authenticated using(public.komya_is_admin());
create policy komya_invitations_read on public.network_invitations for select to authenticated using(
 invited_user_id=auth.uid() or public.komya_is_staff() or public.komya_network_role(network_invitations.network_id) in ('owner','moderator'));

-- Notifications automatiques : commentaires
create or replace function public.komya_comment_notify() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.komya_notify(p.author_id,new.author_id,'comment','post',new.post_id,'Nouveau commentaire sur votre publication') from public.posts p where p.id=new.post_id; return new; end;$$;
drop trigger if exists komya_comment_n on public.comments;
create trigger komya_comment_n after insert on public.comments for each row execute procedure public.komya_comment_notify();

-- ===== RPC =====
create or replace function public.komya_start_conversation(other uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid;
begin
 if auth.uid() is null or not public.komya_active() then raise exception 'Non autorisé'; end if;
 if other is null or other=auth.uid() then raise exception 'Destinataire invalide'; end if;
 if not exists(select 1 from public.profiles where id=other and suspended_at is null) then raise exception 'Destinataire introuvable'; end if;
 if public.komya_blocked_between(auth.uid(),other) then raise exception 'Conversation impossible'; end if;
 select c.id into cid from public.conversations c where exists(select 1 from public.conversation_members a where a.conversation_id=c.id and a.user_id=auth.uid())
  and exists(select 1 from public.conversation_members b where b.conversation_id=c.id and b.user_id=other)
  and (select count(*) from public.conversation_members z where z.conversation_id=c.id)=2 limit 1;
 if cid is null then
  insert into public.conversations(created_by) values(auth.uid()) returning id into cid;
  insert into public.conversation_members(conversation_id,user_id) values(cid,auth.uid()),(cid,other);
 end if; return cid;
end;$$;
create or replace function public.komya_mark_read(cid uuid) returns void language sql security definer set search_path=public,pg_temp as $$
 update public.conversation_members set last_read_at=now() where conversation_id=cid and user_id=auth.uid();
$$;
create or replace function public.komya_join_challenge(cid uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare pid uuid;
begin
 if not public.komya_active() then raise exception 'Non autorisé'; end if;
 if not exists(select 1 from public.challenges where id=cid and status='published') then raise exception 'Défi indisponible'; end if;
 insert into public.challenge_participants(challenge_id,user_id) values(cid,auth.uid()) on conflict(challenge_id,user_id) do update set status=case when challenge_participants.status='withdrawn' then 'joined' else challenge_participants.status end returning id into pid;
 return pid;
end;$$;
create or replace function public.komya_challenge_progress(cid uuid,pct int) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.challenge_participants set progress_percent=least(greatest(pct,0),99),status='in_progress'
  where challenge_id=cid and user_id=auth.uid() and status in ('joined','in_progress');
 if not found then raise exception 'Participation introuvable ou verrouillée'; end if;
end;$$;
create or replace function public.komya_challenge_submit(cid uuid,txt text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if txt is null or char_length(trim(txt)) not between 1 and 5000 then raise exception 'Résultat invalide'; end if;
 update public.challenge_participants set status='submitted',result_text=trim(txt),submitted_at=now()
  where challenge_id=cid and user_id=auth.uid() and status in ('joined','in_progress');
 if not found then raise exception 'Participation introuvable ou déjà soumise'; end if;
end;$$;
create or replace function public.komya_challenge_review(pid uuid,approve boolean,note text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.challenge_participants;
begin
 if not public.komya_is_staff() then raise exception 'Réservé à la modération'; end if;
 select * into p from public.challenge_participants where id=pid and status='submitted';
 if not found then raise exception 'Soumission introuvable'; end if;
 if p.user_id=auth.uid() then raise exception 'Auto-validation interdite'; end if;
 update public.challenge_participants set status=case when approve then 'completed' else 'in_progress' end,
  progress_percent=case when approve then 100 else progress_percent end, reviewed_by=auth.uid(), review_note=note where id=pid;
 perform public.komya_notify(p.user_id,auth.uid(),'challenge_review','challenge',p.challenge_id,case when approve then 'Votre défi a été validé' else 'Retour sur votre défi' end);
 perform public.komya_audit('challenge_review','challenge_participant',pid,jsonb_build_object('approved',approve));
end;$$;
create or replace function public.komya_leave_network(nid uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.komya_network_role(nid)='owner' then raise exception 'Le propriétaire ne peut pas quitter son réseau'; end if;
 update public.network_members set status='left' where network_id=nid and user_id=auth.uid() and status in ('active','pending');
end;$$;
create or replace function public.komya_invite_to_network(nid uuid,uid uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not (public.komya_is_staff() or public.komya_network_role(nid) in ('owner','moderator')) then raise exception 'Non autorisé'; end if;
 if not exists(select 1 from public.profiles where id=uid and suspended_at is null) then raise exception 'Membre introuvable'; end if;
 insert into public.network_invitations(network_id,invited_user_id,invited_by) values(nid,uid,auth.uid())
  on conflict(network_id,invited_user_id) do update set status='pending',invited_by=auth.uid(),created_at=now();
 perform public.komya_notify(uid,auth.uid(),'network_invitation','network',nid,'Invitation à rejoindre un réseau');
end;$$;
create or replace function public.komya_respond_invitation(iid uuid,accept boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.network_invitations;
begin
 select * into i from public.network_invitations where id=iid and invited_user_id=auth.uid() and status='pending';
 if not found then raise exception 'Invitation introuvable'; end if;
 update public.network_invitations set status=case when accept then 'accepted' else 'declined' end where id=iid;
 if accept then insert into public.network_members(network_id,user_id,role,status) values(i.network_id,i.invited_user_id,'member','active')
  on conflict(network_id,user_id) do update set status='active',role='member'; end if;
end;$$;
create or replace function public.komya_set_role(target uuid,r text,grant_it boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.komya_is_admin() then raise exception 'Réservé aux administrateurs'; end if;
 if r not in ('admin','moderator') then raise exception 'Rôle invalide'; end if;
 if grant_it then insert into public.user_roles(user_id,role) values(target,r) on conflict do nothing;
 else
  if r='admin' and (select count(*) from public.user_roles where role='admin')<=1 then raise exception 'Impossible de retirer le dernier administrateur'; end if;
  delete from public.user_roles where user_id=target and role=r;
 end if;
 perform public.komya_audit('set_role','profile',target,jsonb_build_object('role',r,'granted',grant_it));
end;$$;
create or replace function public.komya_suspend_user(target uuid,suspend boolean,reason text default null) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.komya_is_staff() then raise exception 'Réservé à la modération'; end if;
 if target=auth.uid() or exists(select 1 from public.user_roles where user_id=target and role='admin') then raise exception 'Action interdite sur ce compte'; end if;
 update public.profiles set suspended_at=case when suspend then now() else null end where id=target;
 perform public.komya_audit(case when suspend then 'suspend' else 'unsuspend' end,'profile',target,jsonb_build_object('reason',reason));
end;$$;
create or replace function public.komya_admin_stats() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if not public.komya_is_staff() then raise exception 'Réservé à la modération'; end if;
 return jsonb_build_object('members',(select count(*) from public.profiles),'posts',(select count(*) from public.posts where deleted_at is null),
  'networks',(select count(*) from public.networks),'offers',(select count(*) from public.offers where status='published'),
  'open_reports',(select count(*) from public.reports where status='open'),'challenges_published',(select count(*) from public.challenges where status='published'));
end;$$;

-- Exécution réservée aux utilisateurs connectés
do $$ declare f record; begin
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'komya\_%' loop
  execute format('revoke all on function %s from public, anon',f.sig);
  execute format('grant execute on function %s to authenticated',f.sig);
 end loop; end $$;

-- ===== Storage =====
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp']),
 ('post-media','post-media',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('offer-media','offer-media',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('resource-files','resource-files',false,15728640,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
do $$ declare b text; begin
 foreach b in array array['avatars','post-media','offer-media'] loop
  execute format('drop policy if exists "komya_%s_read" on storage.objects',b);
  execute format('drop policy if exists "komya_%s_write" on storage.objects',b);
  execute format('drop policy if exists "komya_%s_update" on storage.objects',b);
  execute format('drop policy if exists "komya_%s_delete" on storage.objects',b);
  execute format('create policy "komya_%s_read" on storage.objects for select to authenticated using(bucket_id=%L)',b,b);
  execute format('create policy "komya_%s_write" on storage.objects for insert to authenticated with check(bucket_id=%L and (storage.foldername(name))[1]=auth.uid()::text and public.komya_active())',b,b);
  execute format('create policy "komya_%s_update" on storage.objects for update to authenticated using(bucket_id=%L and (storage.foldername(name))[1]=auth.uid()::text)',b,b);
  execute format('create policy "komya_%s_delete" on storage.objects for delete to authenticated using(bucket_id=%L and ((storage.foldername(name))[1]=auth.uid()::text or public.komya_is_staff()))',b,b);
 end loop;
end $$;
drop policy if exists komya_resources_read_files on storage.objects;
create policy komya_resources_read_files on storage.objects for select to authenticated using(bucket_id='resource-files');
drop policy if exists komya_resources_write_files on storage.objects;
create policy komya_resources_write_files on storage.objects for all to authenticated using(bucket_id='resource-files' and public.komya_is_staff()) with check(bucket_id='resource-files' and public.komya_is_staff());

-- ===== Realtime =====
do $$ begin alter publication supabase_realtime add table public.messages; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when others then null; end $$;
