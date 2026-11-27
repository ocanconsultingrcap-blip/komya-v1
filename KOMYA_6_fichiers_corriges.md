---
name: komya-corrections-v11
title: "KOMYA v1.1 : épinglage, suppression de réseau, suppression de compte"
type: text/markdown
---

Correction v1.1 (épinglage, suppression de réseau, suppression de compte) — fichiers complets à remplacer.


===== FICHIER : src/components/PostCard.tsx =====
```tsx
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import ReportButton from './ReportButton';
import Attachments from './Attachments';
import Avatar from './Avatar';

export type Post = { id: string; category?: string; body: string; created_at: string; author_id: string; pinned?: boolean; profiles: { display_name: string; avatar_url?: string | null } | null };
type Comment = { id: string; body: string; created_at: string; author_id: string; profiles: { display_name: string } | null };
type Reaction = { user_id: string; reaction: string };
const REACTIONS: [string, string][] = [['like', '❤️ J’aime'], ['bravo', '👏 Bravo'], ['idea', '💡 Inspirant'], ['support', '🤝 Soutien']];

export default function PostCard({ post, userId, onDelete, canModerate = false }: { post: Post; userId: string; onDelete: (id: string) => void; canModerate?: boolean }) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [pinned, setPinned] = useState(!!post.pinned);
  const [error, setError] = useState('');

  async function loadReactions() {
    const { data, error: err } = await supabase.from('reactions').select('user_id,reaction').eq('post_id', post.id);
    if (err) setError(frError(err)); else setReactions((data ?? []) as Reaction[]);
  }
  async function loadComments() {
    const { data, error: err } = await supabase.from('comments').select('id,body,created_at,author_id,profiles!comments_author_id_fkey(display_name)')
      .eq('post_id', post.id).is('deleted_at', null).order('created_at').limit(100);
    if (err) setError(frError(err)); else setComments((data ?? []) as unknown as Comment[]);
  }
  useEffect(() => { void loadReactions(); }, [post.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function react(kind: string) {
    setError('');
    const mine = reactions.find(r => r.user_id === userId);
    if (mine) {
      const { error: err } = await supabase.from('reactions').delete().eq('post_id', post.id).eq('user_id', userId);
      if (err) { setError(frError(err)); return; }
    }
    if (!mine || mine.reaction !== kind) {
      const { error: err } = await supabase.from('reactions').insert({ post_id: post.id, user_id: userId, reaction: kind });
      if (err) { setError(frError(err)); }
    }
    void loadReactions();
  }

  async function togglePin() {
    setError('');
    const next = !pinned;
    setPinned(next);
    const { error: err } = await supabase.rpc('komya_toggle_pin', { p_pid: post.id });
    if (err) { setPinned(!next); setError(frError(err)); }
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    const { error: err } = await supabase.from('comments').insert({ post_id: post.id, author_id: userId, body: draft.trim() });
    if (err) setError(frError(err)); else { setDraft(''); void loadComments(); }
  }
  async function removeComment(id: string) {
    const { error: err } = await supabase.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (err) setError(frError(err)); else setComments(c => (c ?? []).filter(x => x.id !== id));
  }

  const mine = reactions.find(r => r.user_id === userId)?.reaction;
  return (
    <article className="card">
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><Avatar name={post.profiles?.display_name ?? 'M'} url={post.profiles?.avatar_url} size={36} /><b>{post.profiles?.display_name ?? 'Membre KOMYA'}</b>{pinned && <small>📌 épinglé</small>}</p> {post.category && <small>{post.category}</small>}
      <p style={{ whiteSpace: 'pre-wrap' }}>{post.body}</p>
      <Attachments postId={post.id} />
      <small>{new Date(post.created_at).toLocaleString('fr-FR')}</small>
      <div className="row">
        {REACTIONS.map(([k, label]) => (
          <button key={k} className={mine === k ? '' : 'secondary'} onClick={() => void react(k)}>
            {label} {reactions.filter(r => r.reaction === k).length || ''}
          </button>
        ))}
        <button className="secondary" onClick={() => (comments ? setComments(null) : void loadComments())}>Commentaires</button>
        {canModerate && <button className="secondary" onClick={() => void togglePin()}>{pinned ? 'Désépingler' : '📌 Épingler'}</button>}
        {(post.author_id === userId || canModerate)
          ? <button className="secondary" onClick={() => onDelete(post.id)}>Supprimer</button>
          : <ReportButton userId={userId} targetType="post" targetId={post.id} />}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {comments && (
        <div className="comments">
          {comments.length === 0 && <small>Aucun commentaire.</small>}
          {comments.map(c => (
            <p key={c.id}>
              <b>{c.profiles?.display_name ?? 'Membre KOMYA'}</b> : {c.body}{' '}
              {c.author_id === userId
                ? <button className="secondary" onClick={() => void removeComment(c.id)}>Supprimer</button>
                : <ReportButton userId={userId} targetType="comment" targetId={c.id} />}
            </p>
          ))}
          <form onSubmit={e => void addComment(e)}>
            <input aria-label="Votre commentaire" placeholder="Votre commentaire" maxLength={2000} value={draft} onChange={e => setDraft(e.target.value)} />
            <button disabled={!draft.trim()}>Commenter</button>
          </form>
        </div>
      )}
    </article>
  );
}
```


===== FICHIER : src/components/Feed.tsx =====
```tsx
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { callFn } from '../lib/functions';
import PostCard from './PostCard';
import PostComposer from './PostComposer';
import type { Post } from './PostCard';

const PAGE = 20;

export default function Feed({ userId, staff = false }: { userId: string; staff?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(true);

  const load = useCallback(async (offset: number) => {
    setLoading(true);
    const { data, error: err } = await supabase.from('posts')
      .select('id,body,created_at,author_id,category,pinned,profiles!posts_author_id_fkey(display_name,avatar_url)')
      .is('deleted_at', null).is('network_id', null).order('pinned', { ascending: false }).order('created_at', { ascending: false }).range(offset, offset + PAGE - 1);
    setLoading(false);
    if (err) { setError(frError(err)); return; }
    const rows = (data ?? []) as unknown as Post[];
    setPosts(prev => (offset === 0 ? rows : [...prev, ...rows]));
    setMore(rows.length === PAGE);
  }, []);
  useEffect(() => { void load(0); }, [load]);

  async function remove(id: string) {
    const msg = await callFn('delete-post', { post_id: id });
    if (msg) setError(msg); else setPosts(p => p.filter(x => x.id !== id));
  }

  return (
    <>
      <section className="hero">
        <small>VOTRE ESPACE ENTREPRENEURIAL</small>
        <h1>Les bonnes connexions font avancer les projets.</h1>
      </section>
      <PostComposer userId={userId} networkId={null} onPosted={() => void load(0)} />
      {error && <p className="error" role="alert">{error}</p>}
      {posts.map(p => <PostCard key={p.id} post={p} userId={userId} canModerate={staff} onDelete={id => void remove(id)} />)}
      {!loading && posts.length === 0 && !error && <p>Aucune publication pour le moment. Lance la conversation : partage ton activité ou pose une question.</p>}
      {loading && <p>Chargement…</p>}
      {more && !loading && posts.length > 0 && <button className="secondary" onClick={() => void load(posts.length)}>Voir plus</button>}
    </>
  );
}
```


===== FICHIER : src/components/NetworkView.tsx =====
```tsx
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import { callFn } from '../lib/functions';
import type { Network } from './Networks';
import PostCard from './PostCard';
import type { Post } from './PostCard';
import PostComposer from './PostComposer';

type Member = { user_id: string; role: string; status: string; profiles: { display_name: string } | null };
type Found = { id: string; display_name: string };

export default function NetworkView({ network, userId, myRole, onBack }: { network: Network; userId: string; myRole: string | null; onBack: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const manager = myRole === 'owner' || myRole === 'moderator';

  const load = useCallback(async () => {
    const [p, m] = await Promise.all([
      supabase.from('posts').select('id,body,created_at,author_id,category,pinned,profiles!posts_author_id_fkey(display_name,avatar_url)').eq('network_id', network.id).is('deleted_at', null).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50),
      supabase.from('network_members').select('user_id,role,status,profiles!network_members_user_id_fkey(display_name)').eq('network_id', network.id).in('status', ['active', 'pending']),
    ]);
    const err = p.error ?? m.error;
    if (err) { setError(frError(err)); return; }
    setPosts((p.data ?? []) as unknown as Post[]);
    setMembers((m.data ?? []) as unknown as Member[]);
  }, [network.id]);
  useEffect(() => { void load(); }, [load]);

  async function removePost(id: string) {
    const m = await callFn('delete-post', { post_id: id });
    if (m) setError(m); else void load();
  }
  async function deleteNetwork() {
    if (!window.confirm('Supprimer définitivement ce réseau ? Toutes ses publications seront perdues. Cette action est irréversible.')) return;
    const { error: err } = await supabase.rpc('komya_delete_network', { p_nid: network.id });
    if (err) setError(frError(err)); else onBack();
  }
  async function decide(uid: string, status: 'active' | 'rejected' | 'removed') {
    const { error: err } = await supabase.from('network_members').update({ status }).eq('network_id', network.id).eq('user_id', uid);
    if (err) setError(frError(err)); else void load();
  }
  async function leave() {
    const { error: err } = await supabase.rpc('komya_leave_network', { nid: network.id });
    if (err) setError(frError(err)); else onBack();
  }
  async function find() {
    const term = search.trim().replace(/[%_]/g, '');
    if (!term) return;
    const { data, error: err } = await supabase.from('profiles').select('id,display_name').ilike('display_name', `%${term}%`).neq('id', userId).limit(8);
    if (err) setError(frError(err)); else setFound((data ?? []) as Found[]);
  }
  async function invite(uid: string) {
    const { error: err } = await supabase.rpc('komya_invite_to_network', { nid: network.id, uid });
    if (err) setError(frError(err)); else setMsg('Invitation envoyée.');
  }

  const pending = members.filter(m => m.status === 'pending');
  const active = members.filter(m => m.status === 'active');
  return (
    <>
      <button className="secondary" onClick={onBack}>← Réseaux</button>
      <h2>{network.name}</h2>
      <p><small className="cat">{network.visibility === 'private' ? 'Réseau privé : seuls les membres voient les contenus' : 'Réseau public : tout le monde peut lire, les membres publient'}</small></p>
      <p>{network.description}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p role="status">{msg}</p>}
      {myRole ? <PostComposer userId={userId} networkId={network.id} onPosted={() => void load()} /> : <p><small>Rejoins ce réseau pour publier et réagir.</small></p>}
      {posts.length === 0 && <p>Aucune publication dans ce réseau pour le moment.</p>}
      {posts.map(p => <PostCard key={p.id} post={p} userId={userId} canModerate={manager} onDelete={id => void removePost(id)} />)}
      <div className="card">
        <b>Membres ({active.length})</b>
        {active.map(m => (
          <p key={m.user_id}>{m.profiles?.display_name ?? 'Membre'} <small>{m.role === 'owner' ? 'Responsable' : m.role === 'moderator' ? 'Modérateur' : 'Membre'}</small>{' '}
            {manager && m.role === 'member' && m.user_id !== userId && <button className="secondary" onClick={() => void decide(m.user_id, 'removed')}>Retirer</button>}
          </p>
        ))}
      </div>
      {manager && (
        <>
          {pending.length > 0 && (
            <div className="card">
              <b>Demandes en attente</b>
              {pending.map(m => (
                <p key={m.user_id}>{m.profiles?.display_name ?? 'Membre'}{' '}
                  <button onClick={() => void decide(m.user_id, 'active')}>Accepter</button>{' '}
                  <button className="secondary" onClick={() => void decide(m.user_id, 'rejected')}>Refuser</button>
                </p>
              ))}
            </div>
          )}
          <div className="card">
            <b>Inviter un membre</b>
            <input aria-label="Nom du membre" placeholder="Nom du membre" value={search} onChange={e => setSearch(e.target.value)} />
            <button className="secondary" onClick={() => void find()}>Rechercher</button>
            {found.map(f => <p key={f.id}>{f.display_name} <button onClick={() => void invite(f.id)}>Inviter</button></p>)}
          </div>
        </>
      )}
      {myRole && myRole !== 'owner' && <button className="secondary" onClick={() => void leave()}>Quitter le réseau</button>}
      {myRole === 'owner' && <button className="secondary" onClick={() => void deleteNetwork()}>Supprimer le réseau</button>}
    </>
  );
}
```


===== FICHIER : src/App.tsx =====
```tsx
import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { callFn } from './lib/functions';
import { logoFull } from './logos';
import AuthScreen from './components/AuthScreen';
import Feed from './components/Feed';
import Reseau from './components/Reseau';
import Challenges from './components/Challenges';
import Resources from './components/Resources';
import Messages from './components/Messages';
import Notifications from './components/Notifications';
import Admin from './components/Admin';
import ProfileForm from './components/ProfileForm';
import Share from './components/Share';
import InstallPrompt from './components/InstallPrompt';

type Tab = 'home' | 'network' | 'challenges' | 'resources' | 'messages' | 'notifications' | 'profile' | 'admin';
const TABS: [Tab, string, string][] = [['home', '🏠', 'Accueil'], ['network', '👥', 'Réseau'], ['challenges', '🎯', 'Défis'], ['resources', '📚', 'Ressources'], ['messages', '💬', 'Message']];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [roles, setRoles] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [startOn, setStartOn] = useState<'provider' | null>(null);
  const uid = session?.user.id;

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!uid) return;
    const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('read_at', null);
    setUnread(count ?? 0);
  }, [uid]);

  useEffect(() => {
    if (!uid) { setRoles([]); setUnread(0); return; }
    void supabase.from('user_roles').select('role').eq('user_id', uid).then(({ data }) => setRoles((data ?? []).map(r => r.role as string)));
    void refreshUnread();
    const ch = supabase.channel(`notif-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => void refreshUnread())
      .subscribe();
    void supabase.rpc('komya_mark_delivered');
    const inbox = supabase.channel(`inbox-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => { if ((payload.new as { sender_id?: string }).sender_id !== uid) void supabase.rpc('komya_mark_delivered'); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); void supabase.removeChannel(inbox); };
  }, [uid, refreshUnread]);

  const clearResource = useCallback(() => { setResourceId(null); setStartOn(null); }, []);
  const openResource = useCallback((id: string) => { setResourceId(id); setTab('resources'); }, []);

  async function deleteAccount() {
    if (!window.confirm('Supprimer définitivement ton compte KOMYA ? Tes publications, commentaires et participations seront perdus. Cette action est irréversible.')) return;
    if (!window.confirm('Dernière confirmation : tu ne pourras plus te connecter avec cet e-mail. Supprimer ?')) return;
    const m = await callFn('delete-account', {});
    if (m) { window.alert('Suppression impossible pour le moment : ' + m); return; }
    await supabase.auth.signOut();
  }

  if (!ready) return <main className="auth"><p>Chargement…</p></main>;
  if (!session || recovery || !uid) return <AuthScreen recovery={recovery} onDone={() => setRecovery(false)} />;

  const staff = roles.length > 0;
  return (
    <>
      <header>
        <img src={logoFull} alt="KOMYA" className="logo" />
        <nav>
          <button className="secondary" aria-label="Notifications" onClick={() => setTab('notifications')}>🔔{unread > 0 ? ` ${unread}` : ''}</button>
          {staff && <button className="secondary" aria-label="Administration" onClick={() => setTab('admin')}>⚙️</button>}
          <button className="secondary" aria-label="Profil" onClick={() => setTab('profile')}>👤</button>
        </nav>
      </header>
      <main className="main">
        <InstallPrompt />
        {tab === 'home' && <Feed userId={uid} staff={staff} />}
        {tab === 'network' && <Reseau userId={uid} onOpenResource={openResource} />}
        {tab === 'challenges' && <Challenges userId={uid} />}
        {tab === 'resources' && <Resources userId={uid} initialResource={resourceId} startOn={startOn} onClearInitial={clearResource} />}
        {tab === 'messages' && <Messages userId={uid} />}
        {tab === 'notifications' && <Notifications userId={uid} onChange={() => void refreshUnread()} />}
        {tab === 'admin' && staff && <Admin isAdmin={roles.includes('admin')} />}
        {tab === 'profile' && (
          <>
            <ProfileForm userId={uid} />
            <div className="card">
              <b>🏪 Espace prestataire</b>
              <p><small>Publie tes formations, outils ou services, et suis les accès, les avis et les signalements.</small></p>
              <button onClick={() => { setStartOn('provider'); setTab('resources'); }}>Ouvrir mon espace prestataire</button>
            </div>
            <Share userId={uid} />
            <button className="secondary" onClick={() => void supabase.auth.signOut()}>Se déconnecter</button>
            <button className="secondary" onClick={() => void deleteAccount()}>Supprimer mon compte</button>
          </>
        )}
      </main>
      <div className="tabbar">
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            <span style={{ fontSize: 20, display: 'block' }}>{icon}</span>{label}
          </button>
        ))}
      </div>
    </>
  );
}
```


===== FICHIER : supabase/migrations/0007_komya_social_admin.sql =====
```sql
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
```


===== FICHIER : supabase/functions/delete-account/index.ts =====
```ts
// Edge Function : supprime définitivement le compte de l'appelant (auth + données en cascade).
// À créer dans le tableau de bord Supabase : Edge Functions > Create > nom = delete-account
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return new Response(JSON.stringify({ error: 'Connexion requise' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const uid = userData.user.id;

    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }
});
```
