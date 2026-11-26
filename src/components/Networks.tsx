import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { frError } from '../lib/errors';
import NetworkView from './NetworkView';
import { GROUP_CATS } from '../lib/format';

export type Network = { id: string; name: string; description: string; visibility: 'public' | 'private'; owner_id: string };
type Membership = { network_id: string; role: string; status: string };
type Invitation = { id: string; network_id: string; networks: { name: string } | null };

export default function Networks({ userId }: { userId: string }) {
  const [nets, setNets] = useState<Network[]>([]);
  const [mine, setMine] = useState<Membership[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [vis, setVis] = useState<'public' | 'private'>('public');
  const [cat, setCat] = useState(GROUP_CATS[0]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [n, m, i] = await Promise.all([
      supabase.from('networks').select('id,name,description,visibility,owner_id').order('created_at', { ascending: false }).limit(100),
      supabase.from('network_members').select('network_id,role,status').eq('user_id', userId),
      supabase.from('network_invitations').select('id,network_id,networks(name)').eq('invited_user_id', userId).eq('status', 'pending'),
    ]);
    const err = n.error ?? m.error ?? i.error;
    if (err) { setError(frError(err)); return; }
    setNets((n.data ?? []) as Network[]);
    setMine((m.data ?? []) as Membership[]);
    setInvites((i.data ?? []) as unknown as Invitation[]);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const { error: err } = await supabase.from('networks').insert({ name: name.trim(), description: desc.trim(), visibility: vis, owner_id: userId, category: cat });
    if (err) setError(frError(err)); else { setName(''); setDesc(''); void load(); }
  }
  async function join(n: Network) {
    const { error: err } = await supabase.rpc('komya_join_network', { nid: n.id });
    if (err) setError(frError(err)); else void load();
  }
  async function answer(id: string, accept: boolean) {
    const { error: err } = await supabase.rpc('komya_respond_invitation', { iid: id, accept });
    if (err) setError(frError(err)); else void load();
  }

  if (openId) {
    const n = nets.find(x => x.id === openId);
    if (n) return <NetworkView network={n} userId={userId} myRole={mine.find(m => m.network_id === n.id && m.status === 'active')?.role ?? null}
      onBack={() => { setOpenId(null); void load(); }} />;
  }

  const shown = nets.filter(n => n.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <h2>Réseaux</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {invites.map(i => (
        <div className="card" key={i.id}>
          <b>Invitation : {i.networks?.name ?? 'Réseau privé'}</b>
          <div className="row">
            <button onClick={() => void answer(i.id, true)}>Accepter</button>
            <button className="secondary" onClick={() => void answer(i.id, false)}>Refuser</button>
          </div>
        </div>
      ))}
      <form className="card" onSubmit={e => void create(e)}>
        <b>Créer un réseau</b>
        <input aria-label="Nom du réseau" placeholder="Nom (3 à 80 caractères)" minLength={3} maxLength={80} required value={name} onChange={e => setName(e.target.value)} />
        <textarea aria-label="Description" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
        <select aria-label="Catégorie" value={cat} onChange={e => setCat(e.target.value)}>{GROUP_CATS.map(c => <option key={c}>{c}</option>)}</select>
        <select aria-label="Visibilité" value={vis} onChange={e => setVis(e.target.value as 'public' | 'private')}>
          <option value="public">Public : adhésion directe</option>
          <option value="private">Privé : sur demande ou invitation</option>
        </select>
        <button>Créer</button>
      </form>
      <input aria-label="Rechercher un réseau" placeholder="Rechercher un réseau" value={q} onChange={e => setQ(e.target.value)} />
      {shown.length === 0 && <p>Aucun réseau trouvé.</p>}
      {shown.map(n => {
        const m = mine.find(x => x.network_id === n.id);
        return (
          <div className="card" key={n.id}>
            <b>{n.name}</b> <small>{n.visibility === 'private' ? 'PRIVÉ' : 'PUBLIC'}</small>
            <p>{n.description}</p>
            {m?.status === 'active' && <button onClick={() => setOpenId(n.id)}>Ouvrir</button>}
            {m?.status !== 'active' && n.visibility === 'public' && <button className="secondary" onClick={() => setOpenId(n.id)}>Voir les publications</button>}
            {m?.status === 'pending' && <small>Demande en attente</small>}
            {(!m || m.status === 'left') &&
              <button onClick={() => void join(n)}>{n.visibility === 'public' ? 'Rejoindre' : 'Demander à rejoindre'}</button>}
          </div>
        );
      })}
    </>
  );
}
