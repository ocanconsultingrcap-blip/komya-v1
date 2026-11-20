create extension if not exists pgcrypto;
do $$ begin
 create type public.komya_member_type as enum ('entrepreneur','independent','project_owner','professional','organization');
 create type public.komya_visibility as enum ('public','private');
 create type public.komya_difficulty as enum ('easy','intermediate','advanced');
 create type public.komya_offer_status as enum ('published','archived','draft');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default 'Membre KOMYA',
 country text, city text, sector text,
 member_type public.komya_member_type not null default 'entrepreneur',
 business_name text, bio text, avatar_url text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_roles(
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('admin','moderator')),
 primary key(user_id,role)
);
create table if not exists public.posts(
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 5000), image_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.comments(
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check(char_length(body) between 1 and 2000), created_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.reactions(
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reaction text not null default 'like' check(reaction in ('like','support','insightful')),
 created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create table if not exists public.networks(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
 name text not null check(char_length(name) between 3 and 80), description text not null default '',
 visibility public.komya_visibility not null default 'public', created_at timestamptz not null default now()
);
create table if not exists public.network_members(
 network_id uuid not null references public.networks(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 role text not null default 'member' check(role in ('owner','moderator','member')),
 status text not null default 'pending' check(status in ('pending','active','rejected','left','removed')),
 created_at timestamptz not null default now(), primary key(network_id,user_id)
);
create table if not exists public.network_posts(
 id uuid primary key default gen_random_uuid(), network_id uuid not null references public.networks(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade, body text not null,
 created_at timestamptz not null default now(), deleted_at timestamptz
);
create table if not exists public.challenges(
 id uuid primary key default gen_random_uuid(), title text not null, description text not null, objective text,
 difficulty public.komya_difficulty not null default 'easy', duration_days int not null default 7 check(duration_days between 1 and 365),
 status text not null default 'draft' check(status in ('draft','published','closed','archived')),
 created_by uuid references public.profiles(id), starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.challenge_participants(
 id uuid primary key default gen_random_uuid(), challenge_id uuid not null references public.challenges(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'joined' check(status in ('joined','in_progress','submitted','completed','withdrawn')),
 progress_percent int not null default 0 check(progress_percent between 0 and 100),
 result_text text, submitted_at timestamptz, reviewed_by uuid references public.profiles(id), review_note text,
 joined_at timestamptz not null default now(), unique(challenge_id,user_id)
);
create table if not exists public.offers(
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, description text not null, offer_type text not null check(offer_type in ('product','service')),
 category text, price_amount numeric(14,2) check(price_amount is null or price_amount>=0), currency text not null default 'XOF',
 country text, city text, image_path text, status public.komya_offer_status not null default 'published',
 expires_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.offer_validations(
 id uuid primary key default gen_random_uuid(), offer_id uuid not null references public.offers(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 verdict text not null check(verdict in ('below_market','fair','above_market','insufficient_info','recommend')),
 comment text, created_at timestamptz not null default now(), unique(offer_id,author_id)
);
create table if not exists public.conversations(
 id uuid primary key default gen_random_uuid(), created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.conversation_members(
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, last_read_at timestamptz,
 primary key(conversation_id,user_id)
);
create table if not exists public.messages(
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id), body text not null check(char_length(body) between 1 and 5000),
 created_at timestamptz not null default now(), edited_at timestamptz, deleted_at timestamptz
);
create table if not exists public.blocks(
 blocker_id uuid not null references public.profiles(id) on delete cascade,
 blocked_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create table if not exists public.resources(
 id uuid primary key default gen_random_uuid(), title text not null, summary text, body text, file_path text,
 category text, published boolean not null default false, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.resource_favorites(
 resource_id uuid not null references public.resources(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
 primary key(resource_id,user_id)
);
create table if not exists public.notifications(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 actor_id uuid references public.profiles(id), kind text not null, entity_type text, entity_id uuid,
 title text not null, body text, read_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.announcements(
 id uuid primary key default gen_random_uuid(), title text not null, body text not null, published boolean not null default false,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table if not exists public.reports(
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id),
 target_type text not null, target_id uuid not null, reason text not null, details text,
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 handled_by uuid references public.profiles(id), created_at timestamptz not null default now()
);

create or replace function public.komya_is_staff() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('admin','moderator'));
$$;
create or replace function public.komya_is_admin() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin');
$$;
create or replace function public.komya_is_network_member(nid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.network_members where network_id=nid and user_id=auth.uid() and status='active');
$$;
create or replace function public.komya_is_conversation_member(cid uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.conversation_members where conversation_id=cid and user_id=auth.uid());
$$;
create or replace function public.komya_new_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1),'Membre KOMYA')) on conflict(id) do nothing; return new; end;$$;
drop trigger if exists komya_auth_user_created on auth.users;
create trigger komya_auth_user_created after insert on auth.users for each row execute procedure public.komya_new_user();

create index if not exists komya_posts_feed_idx on public.posts(created_at desc) where deleted_at is null;
create index if not exists komya_comments_post_idx on public.comments(post_id,created_at);
create index if not exists komya_network_members_user_idx on public.network_members(user_id,status);
create index if not exists komya_messages_conversation_idx on public.messages(conversation_id,created_at desc);
create index if not exists komya_offers_feed_idx on public.offers(status,created_at desc);
create index if not exists komya_notifications_user_idx on public.notifications(user_id,created_at desc);

do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','posts','comments','reactions','networks','network_members','network_posts','challenges','challenge_participants','offers','offer_validations','conversations','conversation_members','messages','blocks','resources','resource_favorites','notifications','announcements','reports'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

-- profiles
drop policy if exists komya_profiles_read on public.profiles;
create policy komya_profiles_read on public.profiles for select to authenticated using(true);
drop policy if exists komya_profiles_insert on public.profiles;
create policy komya_profiles_insert on public.profiles for insert to authenticated with check(id=auth.uid());
drop policy if exists komya_profiles_update on public.profiles;
create policy komya_profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
-- privileged roles cannot be self-assigned
drop policy if exists komya_roles_read on public.user_roles;
create policy komya_roles_read on public.user_roles for select to authenticated using(user_id=auth.uid() or public.komya_is_admin());
drop policy if exists komya_roles_admin on public.user_roles;
create policy komya_roles_admin on public.user_roles for all to authenticated using(public.komya_is_admin()) with check(public.komya_is_admin());
-- posts
drop policy if exists komya_posts_read on public.posts;
create policy komya_posts_read on public.posts for select to authenticated using(deleted_at is null);
drop policy if exists komya_posts_insert on public.posts;
create policy komya_posts_insert on public.posts for insert to authenticated with check(author_id=auth.uid());
drop policy if exists komya_posts_update on public.posts;
create policy komya_posts_update on public.posts for update to authenticated using(author_id=auth.uid() or public.komya_is_staff()) with check(author_id=auth.uid() or public.komya_is_staff());
drop policy if exists komya_posts_delete on public.posts;
create policy komya_posts_delete on public.posts for delete to authenticated using(author_id=auth.uid() or public.komya_is_staff());
-- comments/reactions
drop policy if exists komya_comments_read on public.comments;
create policy komya_comments_read on public.comments for select to authenticated using(deleted_at is null);
drop policy if exists komya_comments_insert on public.comments;
create policy komya_comments_insert on public.comments for insert to authenticated with check(author_id=auth.uid());
drop policy if exists komya_comments_manage on public.comments;
create policy komya_comments_manage on public.comments for all to authenticated using(author_id=auth.uid() or public.komya_is_staff()) with check(author_id=auth.uid() or public.komya_is_staff());
drop policy if exists komya_reactions_read on public.reactions;
create policy komya_reactions_read on public.reactions for select to authenticated using(true);
drop policy if exists komya_reactions_insert on public.reactions;
create policy komya_reactions_insert on public.reactions for insert to authenticated with check(user_id=auth.uid());
drop policy if exists komya_reactions_delete on public.reactions;
create policy komya_reactions_delete on public.reactions for delete to authenticated using(user_id=auth.uid());
-- networks
drop policy if exists komya_networks_read on public.networks;
create policy komya_networks_read on public.networks for select to authenticated using(visibility='public' or owner_id=auth.uid() or public.komya_is_network_member(id) or public.komya_is_staff());
drop policy if exists komya_networks_insert on public.networks;
create policy komya_networks_insert on public.networks for insert to authenticated with check(owner_id=auth.uid());
drop policy if exists komya_networks_manage on public.networks;
create policy komya_networks_manage on public.networks for all to authenticated using(owner_id=auth.uid() or public.komya_is_staff()) with check(owner_id=auth.uid() or public.komya_is_staff());
drop policy if exists komya_network_members_read on public.network_members;
create policy komya_network_members_read on public.network_members for select to authenticated using(user_id=auth.uid() or public.komya_is_staff() or public.komya_is_network_member(network_id) or exists(select 1 from public.networks n where n.id=network_id and n.visibility='public'));
drop policy if exists komya_network_members_insert on public.network_members;
create policy komya_network_members_insert on public.network_members for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.networks n where n.id=network_id and ((n.visibility='public' and status='active') or (n.visibility='private' and status='pending'))));
drop policy if exists komya_network_members_manage on public.network_members;
create policy komya_network_members_manage on public.network_members for update to authenticated using(public.komya_is_staff() or exists(select 1 from public.network_members m where m.network_id=network_id and m.user_id=auth.uid() and m.role in ('owner','moderator') and m.status='active')) with check(public.komya_is_staff() or exists(select 1 from public.network_members m where m.network_id=network_id and m.user_id=auth.uid() and m.role in ('owner','moderator') and m.status='active'));
drop policy if exists komya_network_posts_read on public.network_posts;
create policy komya_network_posts_read on public.network_posts for select to authenticated using(deleted_at is null and public.komya_is_network_member(network_id));
drop policy if exists komya_network_posts_insert on public.network_posts;
create policy komya_network_posts_insert on public.network_posts for insert to authenticated with check(author_id=auth.uid() and public.komya_is_network_member(network_id));
drop policy if exists komya_network_posts_manage on public.network_posts;
create policy komya_network_posts_manage on public.network_posts for all to authenticated using(author_id=auth.uid() or public.komya_is_staff()) with check(author_id=auth.uid() or public.komya_is_staff());
-- challenges
drop policy if exists komya_challenges_read on public.challenges;
create policy komya_challenges_read on public.challenges for select to authenticated using(status='published' or public.komya_is_staff());
drop policy if exists komya_challenges_staff on public.challenges;
create policy komya_challenges_staff on public.challenges for all to authenticated using(public.komya_is_staff()) with check(public.komya_is_staff());
drop policy if exists komya_participants_read on public.challenge_participants;
create policy komya_participants_read on public.challenge_participants for select to authenticated using(user_id=auth.uid() or public.komya_is_staff());
drop policy if exists komya_participants_insert on public.challenge_participants;
create policy komya_participants_insert on public.challenge_participants for insert to authenticated with check(user_id=auth.uid());
drop policy if exists komya_participants_update on public.challenge_participants;
create policy komya_participants_update on public.challenge_participants for update to authenticated using(user_id=auth.uid() or public.komya_is_staff()) with check(user_id=auth.uid() or public.komya_is_staff());
-- offers
drop policy if exists komya_offers_read on public.offers;
create policy komya_offers_read on public.offers for select to authenticated using(status='published' or author_id=auth.uid() or public.komya_is_staff());
drop policy if exists komya_offers_insert on public.offers;
create policy komya_offers_insert on public.offers for insert to authenticated with check(author_id=auth.uid());
drop policy if exists komya_offers_manage on public.offers;
create policy komya_offers_manage on public.offers for all to authenticated using(author_id=auth.uid() or public.komya_is_staff()) with check(author_id=auth.uid() or public.komya_is_staff());
drop policy if exists komya_validations_read on public.offer_validations;
create policy komya_validations_read on public.offer_validations for select to authenticated using(exists(select 1 from public.offers o where o.id=offer_id and o.status='published'));
drop policy if exists komya_validations_insert on public.offer_validations;
create policy komya_validations_insert on public.offer_validations for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.offers o where o.id=offer_id and o.author_id<>auth.uid() and o.status='published'));
drop policy if exists komya_validations_manage on public.offer_validations;
create policy komya_validations_manage on public.offer_validations for update using(author_id=auth.uid()) with check(author_id=auth.uid());
-- conversations: secure membership checks; creation/member-add must be implemented through trusted RPC before messaging goes live.
drop policy if exists komya_conversations_read on public.conversations;
create policy komya_conversations_read on public.conversations for select to authenticated using(public.komya_is_conversation_member(id));
drop policy if exists komya_conversations_insert on public.conversations;
create policy komya_conversations_insert on public.conversations for insert to authenticated with check(created_by=auth.uid());
drop policy if exists komya_conv_members_read on public.conversation_members;
create policy komya_conv_members_read on public.conversation_members for select to authenticated using(user_id=auth.uid() or public.komya_is_conversation_member(conversation_id));
drop policy if exists komya_conv_members_insert on public.conversation_members;
create policy komya_conv_members_insert on public.conversation_members for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and c.created_by=auth.uid()));
drop policy if exists komya_messages_read on public.messages;
create policy komya_messages_read on public.messages for select to authenticated using(public.komya_is_conversation_member(conversation_id));
drop policy if exists komya_messages_insert on public.messages;
create policy komya_messages_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and public.komya_is_conversation_member(conversation_id));
drop policy if exists komya_messages_manage on public.messages;
create policy komya_messages_manage on public.messages for update using(sender_id=auth.uid()) with check(sender_id=auth.uid());
-- remaining member-owned/private tables
drop policy if exists komya_blocks_self on public.blocks;
create policy komya_blocks_self on public.blocks for all to authenticated using(blocker_id=auth.uid() or blocked_id=auth.uid()) with check(blocker_id=auth.uid());
drop policy if exists komya_resources_read on public.resources;
create policy komya_resources_read on public.resources for select to authenticated using(published or public.komya_is_staff());
drop policy if exists komya_resources_staff on public.resources;
create policy komya_resources_staff on public.resources for all to authenticated using(public.komya_is_staff()) with check(public.komya_is_staff());
drop policy if exists komya_favorites_self on public.resource_favorites;
create policy komya_favorites_self on public.resource_favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists komya_notifications_self on public.notifications;
create policy komya_notifications_self on public.notifications for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists komya_announcements_read on public.announcements;
create policy komya_announcements_read on public.announcements for select to authenticated using(published or public.komya_is_staff());
drop policy if exists komya_announcements_staff on public.announcements;
create policy komya_announcements_staff on public.announcements for all to authenticated using(public.komya_is_staff()) with check(public.komya_is_staff());
drop policy if exists komya_reports_insert on public.reports;
create policy komya_reports_insert on public.reports for insert to authenticated with check(reporter_id=auth.uid());
drop policy if exists komya_reports_read on public.reports;
create policy komya_reports_read on public.reports for select to authenticated using(reporter_id=auth.uid() or public.komya_is_staff());
