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
      supabase.from('posts').select('id,body,created_at,author_id,category,profiles!posts_author_id_fkey(display_name,avatar_url)').eq('network_id', network.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
      supabase.from('network_members').select('user_id,role,status,profiles(display_name)').eq('network_id', network.id).in('status', ['active', 'pending']),
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
    </>
  );
}
